/**
 * MoodMap — Journal & Time-Letter Editor Screen
 * Supports standard expressive journaling and reflective/time-capsule letter writing
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  LayoutAnimation,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui';
import { MoodFace } from '@/components/ui/MoodFace';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';
import { JOURNAL_PROMPTS, type JournalPrompt } from '@/constants/prompts';
import { MOOD_MAP } from '@/constants/moods';
import { useAppStore } from '@/stores/appStore';
import {
  saveJournalEntry,
  updateJournalEntry,
  getJournalEntryById,
  saveDraft,
  loadDraft,
  deleteDraft,
} from '@/services/journalService';
import { scheduleLetterRevealNotification } from '@/services/letterNotificationService';

const PROMPT_CATEGORIES = ['All', 'Gratitude', 'Reflection', 'Growth', 'Emotion', 'Mindfulness'] as const;
type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

const LETTER_PROMPTS = {
  future_self: [
    { id: 'f1', text: 'Where do you hope to be in your career, mind, and spirit when you read this?', shortLabel: 'Hopes & Dreams' },
    { id: 'f2', text: 'What difficulty are you enduring right now that you want to remind yourself you overcame?', shortLabel: 'Overcoming Struggle' },
    { id: 'f3', text: 'A gentle reminder of what matters most in your life right now:', shortLabel: 'Core Values' },
    { id: 'f4', text: 'Predictions for the future and what you hope remains unchanged:', shortLabel: 'Future Outlook' },
  ],
  past_self: [
    { id: 'p1', text: 'What is something you wish you could tell your younger self during a hard moment?', shortLabel: 'Gentle Comfort' },
    { id: 'p2', text: 'A mistake you made that you are ready to genuinely forgive yourself for:', shortLabel: 'Self-Forgiveness' },
    { id: 'p3', text: 'Look at how far you have journeyed since that pivotal year:', shortLabel: 'Growth & Healing' },
  ],
  someone: [
    { id: 's1', text: 'Words of honest gratitude that you find hard to express out loud:', shortLabel: 'Unspoken Gratitude' },
    { id: 's2', text: 'An unsent letter expressing what is truly on your heart:', shortLabel: 'Unsent Reflection' },
    { id: 's3', text: 'What this person has taught you about yourself and the world:', shortLabel: 'Impact & Meaning' },
  ],
};

const DELIVERY_PRESETS = [
  { label: '30 Days', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year', days: 365 },
] as const;

const MAX_CHARS = 5000;
const AUTO_SAVE_INTERVAL = 2000; // Save every 2 seconds if dirty

export default function JournalEditorScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    prompt?: string;
    promptId?: string;
    entryId?: string;
    mode?: 'journal' | 'letter';
    recipient?: 'future_self' | 'past_self' | 'someone';
  }>();

  const user = useAppStore((s) => s.user);
  const todayMood = useAppStore((s) => s.todayMood);
  const addXP = useAppStore((s) => s.addXP);
  const refreshData = useAppStore((s) => s.refreshData);

  // Edit mode
  const isEditMode = !!params.entryId;

  // Mode: Journal or Letter
  const [editorMode, setEditorMode] = useState<'journal' | 'letter'>(
    params.mode === 'letter' ? 'letter' : 'journal'
  );

  // Letter Specific States
  const [recipient, setRecipient] = useState<'future_self' | 'past_self' | 'someone'>(
    params.recipient || 'future_self'
  );
  const [recipientName, setRecipientName] = useState('');
  
  // Future Me Duration: Preset or Custom
  const [deliveryDays, setDeliveryDays] = useState<number>(30);
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState('30');

  // Collapsible Dropdown State
  const [isLetterPanelOpen, setIsLetterPanelOpen] = useState(false);

  // Past Me / Someone Keyword Lock States
  const [isKeywordLockEnabled, setIsKeywordLockEnabled] = useState(false);
  const [lockKeyword, setLockKeyword] = useState('');
  const [lockHint, setLockHint] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory>('All');
  const [usedPromptId, setUsedPromptId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPrompts, setShowPrompts] = useState(!isEditMode);
  const [loadingEntry, setLoadingEntry] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const contentRef = useRef<TextInput>(null);
  const [successAnim] = useState(() => new Animated.Value(0));

  // Refs for interval-based auto-save
  const isDirty = useRef(false);
  const latestTitle = useRef('');
  const latestContent = useRef('');
  const latestPromptId = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate reveal date for future-self letters
  const activeDays = isCustomDays
    ? Math.max(1, parseInt(customDaysInput || '1', 10))
    : deliveryDays;

  const getCalculatedRevealDate = (days: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0); // 9:00 AM
    return d;
  };

  const calculatedRevealDate = getCalculatedRevealDate(activeDays);

  // Toggle Dropdown with Layout Animation
  const toggleLetterPanel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsLetterPanelOpen((prev) => !prev);
  };

  // Custom Days Increments / Stepper handlers
  const handleAddCustomDays = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const curr = parseInt(customDaysInput || '0', 10);
    const validCurr = isNaN(curr) ? 0 : curr;
    const nextVal = Math.min(3650, Math.max(1, validCurr + amount));
    setCustomDaysInput(nextVal.toString());
  };

  const handleSubtractCustomDays = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const curr = parseInt(customDaysInput || '0', 10);
    const validCurr = isNaN(curr) ? 30 : curr;
    const nextVal = Math.max(1, validCurr - amount);
    setCustomDaysInput(nextVal.toString());
  };

  const handleResetCustomDays = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomDaysInput('30');
  };

  // Load entry or draft on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (isEditMode && params.entryId) {
        const entry = getJournalEntryById(params.entryId);
        if (entry) {
          setTitle(entry.title ?? '');
          setContent(entry.content);
          setUsedPromptId(entry.prompt_used);
          if (entry.subtype === 'letter') {
            setEditorMode('letter');
            if (entry.recipient === 'past_self' || entry.recipient === 'someone' || entry.recipient === 'future_self') {
              setRecipient(entry.recipient);
            }
            if (entry.recipient_name) {
              setRecipientName(entry.recipient_name);
            }
            if (entry.lock_keyword) {
              setIsKeywordLockEnabled(true);
              setLockKeyword(entry.lock_keyword);
              setLockHint(entry.lock_hint || '');
            }
            if (entry.reveal_at) {
              const diffMs = new Date(entry.reveal_at).getTime() - new Date(entry.created_at).getTime();
              const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
              if (days > 0) {
                const presetMatch = DELIVERY_PRESETS.find((p) => p.days === days);
                if (presetMatch) {
                  setDeliveryDays(presetMatch.days);
                  setIsCustomDays(false);
                } else {
                  setIsCustomDays(true);
                  setCustomDaysInput(days.toString());
                }
              }
            }
          }
          latestTitle.current = entry.title ?? '';
          latestContent.current = entry.content;
          latestPromptId.current = entry.prompt_used;
        }
        setLoadingEntry(false);
      } else if (params.prompt) {
        setContent(params.prompt);
        latestContent.current = params.prompt;
        if (params.promptId) {
          setUsedPromptId(params.promptId);
          latestPromptId.current = params.promptId;
        }
        setLoadingEntry(false);
      } else {
        // New entry: check for existing draft
        try {
          const draft = loadDraft(user?.id);
          if (draft && (draft.content.trim().length > 0 || (draft.title && draft.title.trim().length > 0))) {
            setTitle(draft.title ?? '');
            setContent(draft.content);
            setUsedPromptId(draft.prompt_used);
            latestTitle.current = draft.title ?? '';
            latestContent.current = draft.content;
            latestPromptId.current = draft.prompt_used;
            setDraftRestored(true);
          }
        } catch (e) {
          console.error('[JournalEditor] Draft load error:', e);
        }
        setLoadingEntry(false);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Interval-based auto-save (runs continuously while editor is open)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (!isDirty.current) return;

      const hasContent = latestContent.current.trim().length > 0 || latestTitle.current.trim().length > 0;
      if (!hasContent) return;

      try {
        if (isEditMode && params.entryId) {
          updateJournalEntry(params.entryId, {
            title: latestTitle.current.trim() || undefined,
            content: latestContent.current,
          });
        } else if (editorMode === 'journal') {
          saveDraft({
            title: latestTitle.current.trim() || undefined,
            content: latestContent.current,
            promptUsed: latestPromptId.current ?? undefined,
            userId: user?.id,
          });
        }

        isDirty.current = false;
        setAutoSaveStatus('saving');

        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => {
          setAutoSaveStatus('saved');
          statusTimer.current = setTimeout(() => setAutoSaveStatus('idle'), 1000);
        }, 300);
      } catch (e) {
        console.error('[JournalEditor] Auto-save error:', e);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (statusTimer.current) clearTimeout(statusTimer.current);

      // Final save on unmount
      if (isDirty.current) {
        const hasContent = latestContent.current.trim().length > 0 || latestTitle.current.trim().length > 0;
        if (hasContent) {
          try {
            if (isEditMode && params.entryId) {
              updateJournalEntry(params.entryId, {
                title: latestTitle.current.trim() || undefined,
                content: latestContent.current,
              });
            } else if (editorMode === 'journal') {
              saveDraft({
                title: latestTitle.current.trim() || undefined,
                content: latestContent.current,
                promptUsed: latestPromptId.current ?? undefined,
                userId: user?.id,
              });
            }
          } catch (e) {
            console.error('[JournalEditor] Final save error:', e);
          }
        }
      }
    };
  }, [isEditMode, params.entryId, user?.id, editorMode]);

  const handleTitleChange = (text: string) => {
    setTitle(text);
    latestTitle.current = text;
    isDirty.current = true;
  };

  const handleContentChange = (text: string) => {
    if (text.length <= MAX_CHARS) {
      setContent(text);
      latestContent.current = text;
      isDirty.current = true;
    }
  };

  // Filter prompts by category
  const filteredPrompts = selectedCategory === 'All'
    ? JOURNAL_PROMPTS
    : JOURNAL_PROMPTS.filter((p) => p.category === selectedCategory.toLowerCase());

  // Insert prompt text
  const handlePromptTap = (prompt: { id: string; text: string }) => {
    const newContent = content.length === 0
      ? prompt.text + '\n\n'
      : content + '\n\n' + prompt.text + '\n\n';
    handleContentChange(newContent);
    setUsedPromptId(prompt.id);
    latestPromptId.current = prompt.id;
    setShowPrompts(false);
    setTimeout(() => contentRef.current?.focus(), 100);
  };

  // Get mood data for today
  const currentMood = todayMood ? MOOD_MAP[todayMood.moodType] : null;

  // Can save?
  const canSave = content.trim().length > 0 && !saving;

  // Word count
  const wordCount = content.trim().length > 0
    ? content.trim().split(/\s+/).length
    : 0;

  // Dismiss draft restored banner
  const dismissDraftBanner = () => setDraftRestored(false);

  // Discard draft and clear editor
  const discardDraft = () => {
    try { deleteDraft(user?.id); } catch (e) { /* ignore */ }
    setTitle('');
    setContent('');
    latestTitle.current = '';
    latestContent.current = '';
    latestPromptId.current = null;
    setUsedPromptId(null);
    setDraftRestored(false);
    setShowPrompts(true);
    isDirty.current = false;
  };

  // Save / Update handler
  const handleSave = async () => {
    if (!canSave) return;

    const isLetter = editorMode === 'letter';

    // Validate Keyword Locking for Past Me / Someone
    if (isLetter && (recipient === 'past_self' || recipient === 'someone') && isKeywordLockEnabled) {
      if (!lockKeyword.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Keyword Required', 'Please enter a secret keyword password to lock this letter.');
        return;
      }
      if (!lockHint.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Hint Required', 'Please add a hint so you can remember your secret keyword later.');
        return;
      }
    }

    setSaving(true);
    Keyboard.dismiss();

    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      const revealAtIso = isLetter && recipient === 'future_self'
        ? calculatedRevealDate.toISOString()
        : undefined;

      const finalKeyword = isLetter && isKeywordLockEnabled && (recipient === 'past_self' || recipient === 'someone')
        ? lockKeyword.trim()
        : undefined;

      const finalHint = isLetter && isKeywordLockEnabled && (recipient === 'past_self' || recipient === 'someone')
        ? lockHint.trim()
        : undefined;

      if (isEditMode && params.entryId) {
        updateJournalEntry(params.entryId, {
          title: title.trim() || undefined,
          content: content.trim(),
          subtype: isLetter ? 'letter' : 'journal',
          recipient: isLetter ? recipient : undefined,
          recipientName: isLetter && recipient === 'someone' ? recipientName.trim() : undefined,
          revealAt: revealAtIso,
          lockKeyword: finalKeyword,
          lockHint: finalHint,
        });

        if (revealAtIso) {
          await scheduleLetterRevealNotification(params.entryId, title.trim(), revealAtIso);
        }
      } else {
        const savedEntry = saveJournalEntry({
          title: title.trim() || undefined,
          content: content.trim(),
          moodEntryId: todayMood?.id,
          promptUsed: usedPromptId ?? undefined,
          userId: user?.id,
          subtype: isLetter ? 'letter' : 'journal',
          recipient: isLetter ? recipient : undefined,
          recipientName: isLetter && recipient === 'someone' ? recipientName.trim() : undefined,
          revealAt: revealAtIso,
          lockKeyword: finalKeyword,
          lockHint: finalHint,
        });

        if (revealAtIso) {
          await scheduleLetterRevealNotification(savedEntry.id, title.trim(), revealAtIso);
        }

        addXP(isLetter ? 20 : 15);
        try { deleteDraft(user?.id); } catch (e) { /* ignore */ }
      }

      isDirty.current = false;
      refreshData();
      setSaved(true);

      Animated.timing(successAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      setTimeout(() => { router.back(); }, 1200);
    } catch (error) {
      console.error('[JournalEditor] Save error:', error);
      setSaving(false);
    }
  };

  // Auto-save status label
  const autoSaveLabel = autoSaveStatus === 'saving'
    ? 'Saving...'
    : autoSaveStatus === 'saved'
      ? isEditMode ? 'Changes saved' : 'Draft saved'
      : null;

  // Success screen
  if (saved) {
    const isLetter = editorMode === 'letter';
    const isFuture = isLetter && recipient === 'future_self';
    const isKeywordProtected = isLetter && isKeywordLockEnabled && (recipient === 'past_self' || recipient === 'someone');

    return (
      <GradientBackground>
        <Animated.View
          style={[
            styles.successContainer,
            {
              paddingTop: insets.top,
              opacity: successAnim,
              transform: [{
                scale: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              }],
            },
          ]}
        >
          <View style={[styles.successIconCircle, isLetter && styles.successIconCircleLetter]}>
            <Feather
              name={isFuture ? 'lock' : isKeywordProtected ? 'key' : isLetter ? 'mail' : 'check'}
              size={36}
              color={isLetter ? '#C084FC' : Colors.accent.primary}
            />
          </View>
          <Text style={styles.successTitle}>
            {isFuture
              ? 'Time Capsule Sealed!'
              : isKeywordProtected
                ? 'Protected with Keyword!'
                : isLetter
                  ? 'Letter Preserved!'
                  : isEditMode
                    ? 'Entry Updated!'
                    : 'Entry Saved!'}
          </Text>
          <Text style={styles.successSubtitle}>
            {isFuture
              ? `Locked safely until ${calculatedRevealDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`
              : isKeywordProtected
                ? `Protected with your secret keyword. Hint: "${lockHint}"`
                : `${wordCount} words ${isEditMode ? 'updated' : 'written today'}`}
          </Text>
          {!isEditMode && (
            <View style={styles.successXPRow}>
              <Feather name="star" size={16} color={isLetter ? '#C084FC' : Colors.accent.primary} />
              <Text style={[styles.successXP, isLetter && { color: '#C084FC' }]}>
                +{isLetter ? '20' : '15'} XP
              </Text>
            </View>
          )}
        </Animated.View>
      </GradientBackground>
    );
  }

  // Loading state
  if (loadingEntry) {
    return (
      <GradientBackground>
        <View style={[styles.successContainer, { paddingTop: insets.top }]}>
          <Text style={styles.successSubtitle}>Loading...</Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
              <Feather name="x" size={22} color={Colors.text.primary} />
            </Pressable>
            <View style={styles.headerCenter} pointerEvents="none">
              <Text style={styles.headerTitle}>
                {isEditMode ? 'Edit Entry' : editorMode === 'letter' ? 'Time Letter' : 'New Entry'}
              </Text>
              {autoSaveLabel && (
                <Text style={styles.autoSaveText}>{autoSaveLabel}</Text>
              )}
            </View>
            <Pressable
              style={[
                styles.saveBtn,
                editorMode === 'letter' && styles.saveBtnLetter,
                !canSave && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!canSave}
              hitSlop={8}
            >
              <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
                {saving ? 'Saving...' : isEditMode ? 'Update' : editorMode === 'letter' ? 'Seal & Save' : 'Save'}
              </Text>
            </Pressable>
          </View>

          {/* Mode Switcher Pill: Journal vs Letter */}
          {!isEditMode && (
            <View style={styles.modeSwitchContainer}>
              <Pressable
                style={[
                  styles.modeSwitchTab,
                  editorMode === 'journal' && styles.modeSwitchTabActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditorMode('journal');
                }}
              >
                <Feather
                  name="book-open"
                  size={14}
                  color={editorMode === 'journal' ? Colors.text.onAccent : Colors.text.secondary}
                />
                <Text
                  style={[
                    styles.modeSwitchText,
                    editorMode === 'journal' && styles.modeSwitchTextActive,
                  ]}
                >
                  Journal Entry
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeSwitchTab,
                  editorMode === 'letter' && styles.modeSwitchTabActiveLetter,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditorMode('letter');
                }}
              >
                <Feather
                  name="mail"
                  size={14}
                  color={editorMode === 'letter' ? '#FFFFFF' : Colors.text.secondary}
                />
                <Text
                  style={[
                    styles.modeSwitchText,
                    editorMode === 'letter' && styles.modeSwitchTextActiveLetter,
                  ]}
                >
                  Time Letter
                </Text>
              </Pressable>
            </View>
          )}

          {/* Draft Restored Banner */}
          {draftRestored && editorMode === 'journal' && (
            <View style={styles.draftBanner}>
              <Feather name="file-text" size={14} color={Colors.accent.primary} />
              <Text style={styles.draftBannerText}>Draft restored</Text>
              <Pressable onPress={dismissDraftBanner} style={styles.draftBannerBtn}>
                <Text style={styles.draftBannerBtnText}>Continue</Text>
              </Pressable>
              <Pressable onPress={discardDraft} style={styles.draftDiscardBtn}>
                <Text style={styles.draftDiscardText}>Discard</Text>
              </Pressable>
            </View>
          )}

          {/* Letter Mode Settings Panel (Collapsible Dropdown) */}
          {editorMode === 'letter' ? (
            <View style={styles.letterPanel}>
              {/* Dropdown Header Bar (Always Visible) */}
              <Pressable
                style={styles.dropdownHeader}
                onPress={toggleLetterPanel}
                hitSlop={6}
              >
                <View style={styles.dropdownHeaderLeft}>
                  <View style={styles.dropdownIconCircle}>
                    <Feather
                      name={
                        recipient === 'future_self'
                          ? 'send'
                          : recipient === 'past_self'
                            ? 'heart'
                            : 'user'
                      }
                      size={13}
                      color="#C084FC"
                    />
                  </View>
                  <View style={styles.dropdownHeaderTextCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.dropdownRecipientTitle}>
                        {recipient === 'future_self'
                          ? 'To: Future Me'
                          : recipient === 'past_self'
                            ? 'To: Past Me'
                            : recipientName.trim()
                              ? `To: ${recipientName.trim()}`
                              : 'To: Someone Special'}
                      </Text>
                      {recipient === 'future_self' ? (
                        <View style={styles.dropdownStatusBadge}>
                          <Feather name="lock" size={9} color="#FBBF24" />
                          <Text style={styles.dropdownStatusText}>{activeDays}d</Text>
                        </View>
                      ) : isKeywordLockEnabled ? (
                        <View style={[styles.dropdownStatusBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                          <Feather name="key" size={9} color="#FBBF24" />
                          <Text style={styles.dropdownStatusText}>Locked</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.dropdownSubtext}>
                      {recipient === 'future_self'
                        ? `Unlocks ${calculatedRevealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • Tap to ${isLetterPanelOpen ? 'collapse' : 'edit'}`
                        : isKeywordLockEnabled
                          ? `Password Protected • Tap to ${isLetterPanelOpen ? 'collapse' : 'edit'}`
                          : `Open Letter • Tap to ${isLetterPanelOpen ? 'collapse' : 'configure'}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.dropdownChevronBtn}>
                  <Feather
                    name={isLetterPanelOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#C084FC"
                  />
                </View>
              </Pressable>

              {/* Collapsible Dropdown Content */}
              {isLetterPanelOpen && (
                <View style={styles.dropdownBody}>
                  {/* Recipient Segmented Control */}
                  <View style={styles.recipientSegmentContainer}>
                    <Pressable
                      style={[
                        styles.recipientSegmentBtn,
                        recipient === 'future_self' && styles.recipientSegmentBtnActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRecipient('future_self');
                      }}
                    >
                      <Feather
                        name="send"
                        size={13}
                        color={recipient === 'future_self' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'}
                      />
                      <Text
                        style={[
                          styles.recipientSegmentText,
                          recipient === 'future_self' && styles.recipientSegmentTextActive,
                        ]}
                      >
                        Future Me
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.recipientSegmentBtn,
                        recipient === 'past_self' && styles.recipientSegmentBtnActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRecipient('past_self');
                      }}
                    >
                      <Feather
                        name="heart"
                        size={13}
                        color={recipient === 'past_self' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'}
                      />
                      <Text
                        style={[
                          styles.recipientSegmentText,
                          recipient === 'past_self' && styles.recipientSegmentTextActive,
                        ]}
                      >
                        Past Me
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.recipientSegmentBtn,
                        recipient === 'someone' && styles.recipientSegmentBtnActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRecipient('someone');
                      }}
                    >
                      <Feather
                        name="user"
                        size={13}
                        color={recipient === 'someone' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'}
                      />
                      <Text
                        style={[
                          styles.recipientSegmentText,
                          recipient === 'someone' && styles.recipientSegmentTextActive,
                        ]}
                      >
                        Someone
                      </Text>
                    </Pressable>
                  </View>

                  {/* Someone Recipient Name Input */}
                  {recipient === 'someone' && (
                    <View style={styles.recipientNameWrapper}>
                      <Feather name="edit-2" size={13} color="#C084FC" />
                      <TextInput
                        style={styles.recipientNameInput}
                        placeholder="Recipient's name or relationship (e.g. Mom, Best Friend)..."
                        placeholderTextColor="rgba(255, 255, 255, 0.4)"
                        value={recipientName}
                        onChangeText={setRecipientName}
                      />
                    </View>
                  )}

                  {/* Future Me: Time-Capsule Delivery Presets + Custom Option */}
                  {recipient === 'future_self' && (
                    <View style={styles.deliveryContainer}>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionHeaderLeft}>
                          <Feather name="clock" size={12} color="#C084FC" />
                          <Text style={styles.sectionHeaderTitle}>Time Capsule Delivery Duration</Text>
                        </View>
                      </View>

                      {/* Preset Pills */}
                      <View style={styles.presetPillsRow}>
                        {DELIVERY_PRESETS.map((preset) => {
                          const isSelected = !isCustomDays && deliveryDays === preset.days;
                          return (
                            <Pressable
                              key={preset.days}
                              style={[
                                styles.presetPill,
                                isSelected && styles.presetPillActive,
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setIsCustomDays(false);
                                setDeliveryDays(preset.days);
                              }}
                            >
                              <Text
                                style={[
                                  styles.presetPillText,
                                  isSelected && styles.presetPillTextActive,
                                ]}
                              >
                                {preset.label}
                              </Text>
                            </Pressable>
                          );
                        })}

                        <Pressable
                          style={[
                            styles.presetPill,
                            isCustomDays && styles.presetPillActive,
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsCustomDays(true);
                          }}
                        >
                          <Text
                            style={[
                              styles.presetPillText,
                              isCustomDays && styles.presetPillTextActive,
                            ]}
                          >
                            Custom
                          </Text>
                        </Pressable>
                      </View>

                      {/* Custom Days Hero Stepper & Increment Controls */}
                      {isCustomDays && (
                        <View style={styles.customStepperBox}>
                          <View style={styles.stepperRow}>
                            <Pressable
                              style={styles.stepperBtn}
                              onPress={() => handleSubtractCustomDays(10)}
                              hitSlop={8}
                            >
                              <Feather name="minus" size={16} color="#E9D5FF" />
                            </Pressable>

                            <View style={styles.stepperCenter}>
                              <View style={styles.stepperInputWrapper}>
                                <Text style={styles.stepperUnlockLabel}>Unlock in</Text>
                                <View style={styles.stepperPill}>
                                  <TextInput
                                    style={styles.stepperInput}
                                    keyboardType="number-pad"
                                    value={customDaysInput}
                                    onChangeText={(t) => setCustomDaysInput(t.replace(/[^0-9]/g, ''))}
                                    placeholder="30"
                                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                                    maxLength={4}
                                    selectTextOnFocus
                                  />
                                </View>
                                <Text style={styles.stepperUnlockLabel}>days</Text>
                              </View>
                            </View>

                            <Pressable
                              style={styles.stepperBtn}
                              onPress={() => handleAddCustomDays(10)}
                              hitSlop={8}
                            >
                              <Feather name="plus" size={16} color="#E9D5FF" />
                            </Pressable>
                          </View>

                          {/* Increments Row: Clicking adds to the current value */}
                          <View style={styles.quickIncrementsRow}>
                            {[
                              { label: '+7d', amount: 7 },
                              { label: '+14d', amount: 14 },
                              { label: '+45d', amount: 45 },
                              { label: '+100d', amount: 100 },
                            ].map((item) => (
                              <Pressable
                                key={item.label}
                                style={styles.quickIncrementChip}
                                onPress={() => handleAddCustomDays(item.amount)}
                              >
                                <Text style={styles.quickIncrementText}>{item.label}</Text>
                              </Pressable>
                            ))}

                            <Pressable
                              style={styles.quickResetChip}
                              onPress={handleResetCustomDays}
                            >
                              <Feather name="rotate-ccw" size={11} color="#C084FC" />
                              <Text style={styles.quickResetText}>Reset</Text>
                            </Pressable>
                          </View>
                        </View>
                      )}

                      {/* Delivery Unlock Banner */}
                      <View style={styles.deliveryUnlockBanner}>
                        <View style={styles.bannerIconCircle}>
                          <Feather name="shield" size={13} color="#C084FC" />
                        </View>
                        <View style={styles.bannerTextCol}>
                          <Text style={styles.bannerTitleText}>
                            Seals automatically • Unlocks on{' '}
                            <Text style={styles.bannerDateHighlight}>
                              {calculatedRevealDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </Text>
                          </Text>
                          <Text style={styles.bannerSubText}>
                            ({activeDays} {activeDays === 1 ? 'day' : 'days'} duration)
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Past Me / Someone: Secret Keyword & Hint Locking Option */}
                  {(recipient === 'past_self' || recipient === 'someone') && (
                    <View style={styles.keywordLockSection}>
                      <Pressable
                        style={styles.keywordLockToggleRow}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setIsKeywordLockEnabled((prev) => !prev);
                        }}
                      >
                        <View style={styles.keywordLockToggleLeft}>
                          <View style={styles.miniIconBox}>
                            <Feather
                              name={isKeywordLockEnabled ? 'lock' : 'unlock'}
                              size={13}
                              color={isKeywordLockEnabled ? '#FBBF24' : Colors.text.tertiary}
                            />
                          </View>
                          <View>
                            <Text style={styles.keywordLockToggleTitle}>Lock with Secret Keyword</Text>
                            <Text style={styles.keywordLockToggleSub}>
                              {isKeywordLockEnabled ? 'Protected with keyword + hint' : 'Optional private lock'}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.switchTrack, isKeywordLockEnabled && styles.switchTrackActive]}>
                          <View style={[styles.switchThumb, isKeywordLockEnabled && styles.switchThumbActive]} />
                        </View>
                      </Pressable>

                      {isKeywordLockEnabled && (
                        <View style={styles.keywordFieldsContainer}>
                          {/* Keyword Input */}
                          <View style={styles.keywordInputWrapper}>
                            <Feather name="key" size={13} color="#FBBF24" />
                            <TextInput
                              style={styles.keywordTextInput}
                              placeholder="Secret Keyword password (e.g. coffee, summer)..."
                              placeholderTextColor="rgba(255, 255, 255, 0.35)"
                              value={lockKeyword}
                              onChangeText={setLockKeyword}
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                          </View>

                          {/* Hint Input */}
                          <View style={styles.keywordInputWrapper}>
                            <Feather name="help-circle" size={13} color="#FBBF24" />
                            <TextInput
                              style={styles.keywordTextInput}
                              placeholder="Keyword Hint (Required: e.g. Our favorite road trip city)..."
                              placeholderTextColor="rgba(255, 255, 255, 0.35)"
                              value={lockHint}
                              onChangeText={setLockHint}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Dedicated Letter Prompts */}
                  {showPrompts && (
                    <View style={styles.letterPromptsWrapper}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptRow}>
                        {LETTER_PROMPTS[recipient].map((p) => (
                          <Pressable
                            key={p.id}
                            style={[styles.promptChip, styles.letterPromptChip]}
                            onPress={() => handlePromptTap(p)}
                          >
                            <Feather name="feather" size={14} color="#C084FC" />
                            <Text style={styles.promptLabel}>{p.shortLabel}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Collapse Done Button */}
                  <Pressable
                    style={styles.dropdownDoneBtn}
                    onPress={toggleLetterPanel}
                  >
                    <Feather name="check" size={13} color="#E9D5FF" />
                    <Text style={styles.dropdownDoneText}>Done Configuring</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Mood Chip for Standard Journal */}
              {currentMood && !isEditMode && (
                <View style={styles.moodChipRow}>
                  <View style={[styles.moodChip, { borderColor: currentMood.color + '40' }]}>
                    <MoodFace
                      expression={currentMood.expression}
                      bgColor={currentMood.bgColor}
                      faceColor={currentMood.faceColor}
                      size="xs"
                    />
                    <Text style={[styles.moodChipText, { color: currentMood.color }]}>
                      Feeling {currentMood.label}
                    </Text>
                  </View>
                </View>
              )}

              {/* Prompt Section for Standard Journal */}
              {showPrompts && (
                <View style={styles.promptSection}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryRow}
                  >
                    {PROMPT_CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        style={[
                          styles.categoryChip,
                          selectedCategory === cat && styles.categoryChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryText,
                            selectedCategory === cat && styles.categoryTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.promptRow}
                  >
                    {filteredPrompts.map((prompt) => (
                      <Pressable
                        key={prompt.id}
                        style={styles.promptChip}
                        onPress={() => handlePromptTap(prompt)}
                      >
                        <Feather
                          name={prompt.icon as any}
                          size={16}
                          color={Colors.accent.primary}
                        />
                        <Text style={styles.promptLabel}>{prompt.shortLabel}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          {/* Toggle prompts */}
          {!showPrompts && (
            <Pressable
              style={[styles.showPromptsBtn, editorMode === 'letter' && styles.showPromptsBtnLetter]}
              onPress={() => setShowPrompts(true)}
            >
              <Feather
                name="help-circle"
                size={14}
                color={editorMode === 'letter' ? '#C084FC' : Colors.accent.primary}
              />
              <Text style={[styles.showPromptsText, editorMode === 'letter' && { color: '#C084FC' }]}>
                {editorMode === 'letter' ? 'Inspiration prompts' : 'Need a prompt?'}
              </Text>
            </Pressable>
          )}

          {/* Editor Area */}
          <ScrollView
            style={styles.editorScroll}
            contentContainerStyle={styles.editorContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.titleInput}
              placeholder={
                editorMode === 'letter'
                  ? recipient === 'future_self'
                    ? 'A note to my future self...'
                    : recipient === 'past_self'
                      ? 'Healing words for my younger self...'
                      : 'Words I needed to write...'
                  : 'Give it a title...'
              }
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              value={title}
              onChangeText={handleTitleChange}
              selectionColor={editorMode === 'letter' ? '#C084FC' : Colors.accent.primary}
              returnKeyType="next"
              onSubmitEditing={() => contentRef.current?.focus()}
            />
            <TextInput
              ref={contentRef}
              style={styles.contentInput}
              placeholder={
                editorMode === 'letter'
                  ? recipient === 'future_self'
                    ? 'Dear Future Me,\n\nI hope when you open this, you remember...'
                    : recipient === 'past_self'
                      ? 'Dear Younger Me,\n\nI want you to know that...'
                      : 'Dear ' + (recipientName || 'Someone') + ',\n\nHere is what I’ve been holding...'
                  : 'Start writing...'
              }
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              value={content}
              onChangeText={handleContentChange}
              selectionColor={editorMode === 'letter' ? '#C084FC' : Colors.accent.primary}
              multiline
              textAlignVertical="top"
              autoFocus={!params.prompt && !isEditMode}
            />
          </ScrollView>

          {/* Footer Stats */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
            <Text style={styles.footerStat}>
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </Text>
            <Text style={styles.footerCount}>
              {content.length}/{MAX_CHARS}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    position: 'relative',
    height: 44,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  autoSaveText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  saveBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent.primary,
    zIndex: 2,
  },
  saveBtnLetter: {
    backgroundColor: '#7C3AED',
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  saveBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.onAccent,
  },
  saveBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.35)',
  },

  // Mode Switcher Container
  modeSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: Radius.pill,
    padding: 3,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeSwitchTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  modeSwitchTabActive: {
    backgroundColor: Colors.accent.primary,
  },
  modeSwitchTabActiveLetter: {
    backgroundColor: '#7C3AED',
  },
  modeSwitchText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  modeSwitchTextActive: {
    color: Colors.text.onAccent,
  },
  modeSwitchTextActiveLetter: {
    color: '#FFFFFF',
  },

  // Letter Configuration Card (Collapsible Dropdown)
  letterPanel: {
    marginBottom: Spacing.sm,
    backgroundColor: '#18122B',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    overflow: 'hidden',
  },

  // Dropdown Header Bar
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: '#18122B',
  },
  dropdownHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
  dropdownHeaderTextCol: {
    flex: 1,
  },
  dropdownRecipientTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
  },
  dropdownStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  dropdownStatusText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny - 1.5,
    color: '#FBBF24',
    textTransform: 'uppercase',
  },
  dropdownSubtext: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny - 0.5,
    color: 'rgba(233, 213, 255, 0.65)',
    marginTop: 1,
  },
  dropdownChevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
  },

  // Dropdown Body Content
  dropdownBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },

  // Recipient Segmented Bar
  recipientSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F0B1E',
    borderRadius: Radius.pill,
    padding: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  recipientSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  recipientSegmentBtnActive: {
    backgroundColor: '#7C3AED',
  },
  recipientSegmentText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption - 0.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  recipientSegmentTextActive: {
    fontFamily: Fonts.bodySemiBold,
    color: '#FFFFFF',
  },

  // Someone Name Input Wrapper
  recipientNameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F0B1E',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 7,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  recipientNameInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
    paddingVertical: 0,
  },

  // Delivery Container
  deliveryContainer: {
    marginTop: Spacing.sm + 2,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  sectionHeader: {
    marginBottom: Spacing.xs + 2,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: '#E9D5FF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  miniIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Preset Pills Row
  presetPillsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  presetPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: '#0F0B1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#C084FC',
  },
  presetPillText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  presetPillTextActive: {
    fontFamily: Fonts.bodySemiBold,
    color: '#FFFFFF',
  },

  // Custom Days Hero Stepper Box
  customStepperBox: {
    marginTop: Spacing.sm,
    backgroundColor: '#0F0B1E',
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
  stepperCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stepperUnlockLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: '#E9D5FF',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  stepperPill: {
    backgroundColor: 'rgba(124, 58, 237, 0.35)',
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: '#C084FC',
    height: 38,
    minWidth: 64,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    minWidth: 40,
    height: '100%',
  },

  // Quick Increment Pills
  quickIncrementsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginTop: Spacing.md - 2,
    paddingTop: Spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  quickIncrementChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  quickIncrementText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: '#E9D5FF',
  },
  quickResetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  quickResetText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: '#C084FC',
  },

  // Delivery Unlock Banner
  deliveryUnlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    backgroundColor: '#0F0B1E',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.22)',
  },
  bannerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitleText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny + 0.5,
    color: '#E9D5FF',
    lineHeight: 16,
  },
  bannerDateHighlight: {
    fontFamily: Fonts.bodySemiBold,
    color: '#FFFFFF',
  },
  bannerSubText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny - 0.5,
    color: 'rgba(233, 213, 255, 0.7)',
    marginTop: 1,
  },

  // Keyword Lock Section
  keywordLockSection: {
    marginTop: Spacing.sm + 2,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  keywordLockToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F0B1E',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  keywordLockToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keywordLockToggleTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
  },
  keywordLockToggleSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny - 1,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  switchTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#7C3AED',
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  keywordFieldsContainer: {
    marginTop: Spacing.xs + 2,
    gap: 6,
  },
  keywordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F0B1E',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  keywordTextInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
    paddingVertical: 2,
  },

  letterPromptsWrapper: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  letterPromptChip: {
    borderColor: 'rgba(192, 132, 252, 0.25)',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },

  // Dropdown Done / Collapse Button
  dropdownDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: Radius.pill,
    paddingVertical: 7,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  dropdownDoneText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: '#E9D5FF',
  },

  // Draft Banner
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.accent.primary + '30',
    marginBottom: Spacing.md,
  },
  draftBannerText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
    flex: 1,
  },
  draftBannerBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent.primary + '25',
  },
  draftBannerBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.accent.primary,
  },
  draftDiscardBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  draftDiscardText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },

  // Mood Chip
  moodChipRow: {
    marginBottom: Spacing.md,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glass.bgSubtle,
    borderWidth: 1,
  },
  moodChipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
  },

  // Prompt Section
  promptSection: {
    marginBottom: Spacing.md,
  },
  categoryRow: {
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  categoryChipActive: {
    backgroundColor: Colors.accent.primaryMuted,
    borderColor: Colors.accent.primary + '40',
  },
  categoryText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  categoryTextActive: {
    color: Colors.accent.primary,
    fontFamily: Fonts.bodySemiBold,
  },
  promptRow: {
    paddingTop: Spacing.xs,
    gap: Spacing.sm,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.borderSubtle,
  },
  promptLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.text.primary,
  },

  // Show prompts toggle
  showPromptsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent.primaryMuted,
  },
  showPromptsBtnLetter: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  showPromptsText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },

  // Editor
  editorScroll: {
    flex: 1,
  },
  editorContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xxxl,
  },
  titleInput: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  contentInput: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    lineHeight: 26,
    minHeight: 200,
    flex: 1,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.borderSubtle,
  },
  footerStat: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  footerCount: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.5)',
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  successIconCircleLetter: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderWidth: 1,
    borderColor: '#C084FC',
  },
  successTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  successXPRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  successXP: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.h3,
    color: Colors.accent.primary,
  },
});
