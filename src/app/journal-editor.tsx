/**
 * MoodMap — Journal Editor Screen
 * Full-featured journal writing with continuous auto-save (interval-based),
 * prompt suggestions, mood linking, and save/edit flow.
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui';
import { MoodFace } from '@/components/ui/MoodFace';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';
import { JOURNAL_PROMPTS, type JournalPrompt } from '@/constants/prompts';
import { MOOD_MAP, type MoodType } from '@/constants/moods';
import { useAppStore } from '@/stores/appStore';
import {
  saveJournalEntry,
  updateJournalEntry,
  getJournalEntryById,
  saveDraft,
  loadDraft,
  deleteDraft,
} from '@/services/journalService';

const PROMPT_CATEGORIES = ['All', 'Gratitude', 'Reflection', 'Growth', 'Emotion', 'Mindfulness'] as const;
type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

const MAX_CHARS = 5000;
const AUTO_SAVE_INTERVAL = 2000; // Save every 2 seconds if dirty

export default function JournalEditorScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    prompt?: string;
    promptId?: string;
    entryId?: string;
  }>();

  const user = useAppStore((s) => s.user);
  const todayMood = useAppStore((s) => s.todayMood);
  const addXP = useAppStore((s) => s.addXP);
  const refreshData = useAppStore((s) => s.refreshData);

  // Edit mode
  const isEditMode = !!params.entryId;

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

  // Load entry or draft on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (isEditMode && params.entryId) {
        const entry = getJournalEntryById(params.entryId);
        if (entry) {
          setTitle(entry.title ?? '');
          setContent(entry.content);
          setUsedPromptId(entry.prompt_used);
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
          // Edit mode: auto-save directly to the existing entry
          updateJournalEntry(params.entryId, {
            title: latestTitle.current.trim() || undefined,
            content: latestContent.current,
          });
        } else {
          // New entry: save to draft
          saveDraft({
            title: latestTitle.current.trim() || undefined,
            content: latestContent.current,
            promptUsed: latestPromptId.current ?? undefined,
            userId: user?.id,
          });
        }

        isDirty.current = false;
        setAutoSaveStatus('saving');

        // Show "Saved" briefly then return to idle
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
            } else {
              saveDraft({
                title: latestTitle.current.trim() || undefined,
                content: latestContent.current,
                promptUsed: latestPromptId.current ?? undefined,
                userId: user?.id,
              });
            }
          } catch (e) {
            console.error('[JournalEditor] Unmount save error:', e);
          }
        }
      }
    };
  }, [isEditMode, params.entryId, user?.id]);

  // Track changes via refs (instant, no re-render delay)
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
  const handlePromptTap = (prompt: JournalPrompt) => {
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

  // Save / Update handler (explicit save button)
  const handleSave = () => {
    if (!canSave) return;
    setSaving(true);
    Keyboard.dismiss();

    // Stop the auto-save interval
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      if (isEditMode && params.entryId) {
        updateJournalEntry(params.entryId, {
          title: title.trim() || undefined,
          content: content.trim(),
        });
      } else {
        saveJournalEntry({
          title: title.trim() || undefined,
          content: content.trim(),
          moodEntryId: todayMood?.id,
          promptUsed: usedPromptId ?? undefined,
          userId: user?.id,
        });
        addXP(15);

        // Clear draft after successful save
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
          <View style={styles.successIconCircle}>
            <Feather name="check" size={40} color={Colors.accent.primary} />
          </View>
          <Text style={styles.successTitle}>
            {isEditMode ? 'Entry Updated!' : 'Entry Saved!'}
          </Text>
          <Text style={styles.successSubtitle}>
            {wordCount} words {isEditMode ? 'updated' : 'written today'}
          </Text>
          {!isEditMode && (
            <View style={styles.successXPRow}>
              <Feather name="star" size={16} color={Colors.accent.primary} />
              <Text style={styles.successXP}>+15 XP</Text>
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
            <Pressable style={styles.closeBtn} onPress={() => router.back()}>
              <Feather name="x" size={22} color={Colors.text.primary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {isEditMode ? 'Edit Entry' : 'New Entry'}
              </Text>
              {autoSaveLabel && (
                <Text style={styles.autoSaveText}>{autoSaveLabel}</Text>
              )}
            </View>
            <Pressable
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
                {saving ? 'Saving...' : isEditMode ? 'Update' : 'Save'}
              </Text>
            </Pressable>
          </View>

          {/* Draft Restored Banner */}
          {draftRestored && (
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

          {/* Mood Chip */}
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

          {/* Prompt Section */}
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

          {/* Toggle prompts */}
          {!showPrompts && (
            <Pressable
              style={styles.showPromptsBtn}
              onPress={() => setShowPrompts(true)}
            >
              <Feather name="help-circle" size={14} color={Colors.accent.primary} />
              <Text style={styles.showPromptsText}>Need a prompt?</Text>
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
              placeholder="Give it a title..."
              placeholderTextColor={Colors.text.tertiary}
              value={title}
              onChangeText={handleTitleChange}
              selectionColor={Colors.accent.primary}
              returnKeyType="next"
              onSubmitEditing={() => contentRef.current?.focus()}
            />
            <TextInput
              ref={contentRef}
              style={styles.contentInput}
              placeholder="Start writing..."
              placeholderTextColor={Colors.text.tertiary}
              value={content}
              onChangeText={handleContentChange}
              selectionColor={Colors.accent.primary}
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
    marginBottom: Spacing.lg,
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
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  autoSaveText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  saveBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent.primary,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.glass.bg,
  },
  saveBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.onAccent,
  },
  saveBtnTextDisabled: {
    color: Colors.text.tertiary,
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
    backgroundColor: Colors.glass.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.glass.borderSubtle,
  },
  categoryChipActive: {
    backgroundColor: Colors.accent.primaryMuted,
    borderColor: Colors.accent.primary + '40',
  },
  categoryText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  categoryTextActive: {
    color: Colors.accent.primary,
    fontFamily: Fonts.bodySemiBold,
  },
  promptRow: {
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
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
    marginBottom: Spacing.lg,
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
    color: Colors.text.secondary,
  },
  footerCount: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.tertiary,
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
