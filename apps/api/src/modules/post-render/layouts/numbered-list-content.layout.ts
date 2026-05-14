import { resolveVisualBackground, resolveVisualBackgroundStyle, resolveAccent, resolveTextColor, slideIndicatorText, getSlot, getListSlot, renderDecorations, renderHeadline } from './layout-helpers';
import type { LayoutProps } from './layout.types';

export function numberedListContentLayout({ slide, contract, width, height, slideNumber, visualSpec }: LayoutProps): object {
  const bg = resolveVisualBackground(slide.styleRules, contract, visualSpec);
  const textColor = resolveTextColor(bg, contract);
  const accent = resolveAccent(contract, visualSpec);
  const mutedColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';

  const headline = getSlot(slide, 'headline');
  const body = getSlot(slide, 'body');
  const items = getListSlot(slide, 'list_items');
  const cta = getSlot(slide, 'cta');

  const itemBoxBg = visualSpec?.listItemBg || accent;
  const itemBoxTextColor = resolveTextColor(itemBoxBg, contract);

  const decorationDivs = renderDecorations(contract, width, height, visualSpec);

  const mainChildren: object[] = [];

  if (slide.styleRules.showSlideIndicator && slideNumber != null) {
    mainChildren.push({
      type: 'div',
      props: {
        style: { fontSize: 13, color: accent, fontWeight: 700, marginBottom: 14 },
        children: slideIndicatorText(slideNumber, contract.totalSlides),
      },
    });
  }

  if (headline) {
    mainChildren.push(renderHeadline(headline, contract, textColor, Math.round(contract.headingSize * 0.78), visualSpec));
    mainChildren.push({
      type: 'div',
      props: {
        style: {
          width: 48,
          height: 4,
          backgroundColor: accent,
          borderRadius: 2,
          marginTop: 10,
          marginBottom: 18,
        },
      },
    });
  }

  if (body && items.length === 0) {
    mainChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: contract.bodySize,
          color: mutedColor,
          lineHeight: contract.lineHeight,
          fontFamily: contract.bodyFont,
        },
        children: body,
      },
    });
  }

  const listItemElements: object[] = items.map((item, i) => ({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        backgroundColor: itemBoxBg,
        borderRadius: contract.borderRadius || 8,
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 16,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: itemBoxTextColor,
              color: itemBoxBg,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              flexShrink: 0,
            },
            children: String(i + 1),
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: contract.bodySize,
              color: itemBoxTextColor,
              lineHeight: 1.4,
              fontFamily: contract.bodyFont,
              flex: 1,
            },
            children: item,
          },
        },
      ],
    },
  }));

  mainChildren.push(...listItemElements);

  if (cta && items.length === 0) {
    mainChildren.push({
      type: 'div',
      props: {
        style: {
          marginTop: 18,
          fontSize: contract.bodySize,
          color: accent,
          fontWeight: 700,
          fontFamily: contract.bodyFont,
        },
        children: `${cta} ->`,
      },
    });
  }

  const bottomChildren: object[] = [];
  if (slide.styleRules.showLogo && contract.logo?.base64) {
    bottomChildren.push({
      type: 'img',
      props: { src: contract.logo.base64, style: { height: contract.logo.heightPx, objectFit: 'contain' } },
    });
  }

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
          props: { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: mainChildren },
        },
        ...(bottomChildren.length > 0
          ? [{
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', paddingTop: 12, flexShrink: 0 },
              children: bottomChildren,
            },
          }]
          : []),
      ],
    },
  };
}
