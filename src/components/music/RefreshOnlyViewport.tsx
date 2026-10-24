import React, { forwardRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

/** A viewport-sized canvas with native pull-to-refresh but no vertical content range.
 * Measure the outer frame, never the scroll content: cached list measurements
 * must not grow this frame when returning from a scrollable tab or detail page.
 */
export const RefreshOnlyViewport = forwardRef<ScrollView, ScrollViewProps>(function RefreshOnlyViewport(
  { children, style, contentContainerStyle, ...props }, ref,
) {
  const [height, setHeight] = useState(0);
  return (
    <View style={styles.frame} onLayout={event => {
      const nextHeight = Math.max(0, Math.floor(event.nativeEvent.layout.height));
      setHeight(previous => previous === nextHeight ? previous : nextHeight);
    }}>
      <ScrollView
        {...props}
        ref={ref}
        style={[style, styles.scroll]}
        contentContainerStyle={[
          contentContainerStyle,
          { height, minHeight: height, maxHeight: height, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
        ]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        alwaysBounceVertical
        bounces
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        {height > 0 ? children : null}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, overflow: 'hidden' },
  scroll: { flex: 1, minHeight: 0 },
});
