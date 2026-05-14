import { resolveVisualBackground, resolveVisualBackgroundStyle, resolveAccent, resolveTextColor, slideIndicatorText, getSlot, getListSlot, renderDecorations, renderHeadline } from './layout-helpers';
import type { LayoutProps } from './layout.types';

export function listLayout({ slide, contract, width, height, slideNumber, visualSpec }: LayoutProps): object {
  const bg = resolveVisualBackground(slide.styleRules, contract, visualSpec);
  const textColor = resolveTextColor(bg, contract);
  const accent = resolveAccent(contract, visualSpec);
  const mutedColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  const headline = getSlot(slide, 'headline');
  const items = getListSlot(slide, 'list_items');

  const itemBoxBg = visualSpec?.listItemBg ?? null;
  const itemBoxTextColor = itemBoxBg ? resolveTextColor(itemBoxBg, contract) : textColor;

  const listItemElements: object[] = items.map((item, i) => {
    const numberBadge = {
      type: 'div',
      props: {
        style: {
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: itemBoxBg ? itemBoxTextColor : accent,
          color: itemBoxBg ? itemBoxBg : '#ffffff',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
          flexShrink: 0,
          marginTop: itemBoxBg ? 0 : 2,
        },
        children: String(i + 1),
      },
    };

    const itemText = {
      type: 'div',
      props: { style: { fontSize: contract.bodySize, color: itemBoxBg ? itemBoxTextColor : textColor, lineHeight: 1.5, fontFamily: contract.bodyFont, flex: 1 }, children: item },
    };

    if (itemBoxBg) {
      return {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
            backgroundColor: itemBoxBg,
            borderRadius: contract.borderRadius || 8,
            padding: '10px 16px',
          },
          children: [numberBadge, itemText],
        },
      };
    }

    return {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
        children: [numberBadge, itemText],
      },
    };
  });

  const topChildren: object[] = [];
  if (slide.styleRules.accentType === 'left-stripe') {
    topChildren.push({
      type: 'div',
      props: { style: { width: 6, backgroundColor: accent, borderRadius: 3, marginRight: 24, alignSelf: 'stretch', flexShrink: 0 } },
    });
  }

  const innerChildren: object[] = [];
  if (slide.styleRules.showSlideIndicator && slideNumber != null) {
    innerChildren.push({
      type: 'div',
      props: { style: { fontSize: 13, color: accent, fontWeight: 700, marginBottom: 12 }, children: slideIndicatorText(slideNumber, contract.totalSlides) },
    });
  }
  if (headline) {
    innerChildren.push(renderHeadline(headline, contract, textColor, Math.round(contract.headingSize * 0.8), visualSpec));
  }
  innerChildren.push(...listItemElements);

  topChildren.push({
    type: 'div',
    props: { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: innerChildren },
  });

  const bottomChildren: object[] = [];
  if (slide.styleRules.showLogo && contract.logo?.base64) {
    bottomChildren.push({
      type: 'img',
      props: { src: contract.logo.base64, style: { height: contract.logo.heightPx, objectFit: 'contain' } },
    });
  }

  const decorationDivs = renderDecorations(contract, width, height, visualSpec);

  return {
    type: 'div',
    props: {
      style: {
        position: 'relative' as const,
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        ...resolveVisualBackgroundStyle(slide.styleRules, contract, visualSpec),
        fontFamily: contract.bodyFont,
        padding: `${contract.paddingY}px ${contract.paddingX}px`,
        overflow: 'hidden',
      },
      children: [
        ...decorationDivs,
        {
          type: 'div',
          props: { style: { display: 'flex', flexDirection: 'row', flex: 1 }, children: topChildren },
        },
        ...(bottomChildren.length > 0 ? [{
          type: 'div',
          props: { style: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', paddingTop: 12 }, children: bottomChildren },
        }] : []),
      ],
    },
  };
}
