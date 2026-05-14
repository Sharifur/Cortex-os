import { resolveVisualBackgroundStyle, resolveAccent, slideIndicatorText, getSlot, renderDecorations, renderHeadline } from './layout-helpers';
import type { LayoutProps } from './layout.types';

export function coverHeroLayout({ slide, contract, width, height, slideNumber, visualSpec }: LayoutProps): object {
  const accent = resolveAccent(contract, visualSpec);
  const textColor = '#ffffff';
  const mutedColor = 'rgba(255,255,255,0.75)';

  const eyebrow = getSlot(slide, 'eyebrow') || getSlot(slide, 'label') || '';
  const headline = getSlot(slide, 'headline');
  const body = getSlot(slide, 'body');
  const cta = getSlot(slide, 'cta');

  const decorationDivs = renderDecorations(contract, width, height, visualSpec);

  const mainChildren: object[] = [];

  if (eyebrow) {
    mainChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: textColor,
          letterSpacing: 3,
          opacity: 0.8,
          marginBottom: 20,
          fontFamily: contract.headingFont,
        },
        children: eyebrow.toUpperCase(),
      },
    });
  }

  if (headline) {
    mainChildren.push(renderHeadline(headline, contract, textColor, Math.min(Math.round(contract.headingSize * 1.25), 96), visualSpec));
  }

  mainChildren.push({
    type: 'div',
    props: {
      style: {
        width: Math.round(width * 0.32),
        height: 3,
        backgroundColor: textColor,
        opacity: 0.55,
        marginTop: 28,
        marginBottom: 28,
        borderRadius: 2,
      },
    },
  });

  if (body) {
    mainChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: contract.bodySize + 2,
          color: mutedColor,
          lineHeight: 1.5,
          fontFamily: contract.bodyFont,
          maxWidth: Math.round(width * 0.78),
        },
        children: body,
      },
    });
  }

  const bottomChildren: object[] = [];

  if (cta) {
    bottomChildren.push({
      type: 'div',
      props: {
        style: {
          border: `2px solid ${textColor}`,
          borderRadius: 999,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 9,
          paddingBottom: 9,
          fontSize: 13,
          fontWeight: 600,
          color: textColor,
          opacity: 0.85,
        },
        children: cta,
      },
    });
  }

  if (slide.styleRules.showLogo && contract.logo?.base64) {
    bottomChildren.push({
      type: 'img',
      props: { src: contract.logo.base64, style: { height: contract.logo.heightPx, objectFit: 'contain' } },
    });
  }

  if (slide.styleRules.showSlideIndicator && slideNumber != null) {
    bottomChildren.push({
      type: 'div',
      props: {
        style: { fontSize: 13, color: mutedColor, marginLeft: 'auto' },
        children: slideIndicatorText(slideNumber, contract.totalSlides),
      },
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
          props: {
            style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' },
            children: mainChildren,
          },
        },
        ...(bottomChildren.length > 0
          ? [{
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 0 },
              children: bottomChildren,
            },
          }]
          : []),
      ],
    },
  };
}
