import { resolveVisualBackground, resolveVisualBackgroundStyle, resolveAccent, resolveTextColor, getSlot } from './layout-helpers';
import type { LayoutProps } from './layout.types';

export function splitPanelLayout({ slide, contract, width, height, visualSpec }: LayoutProps): object {
  const bg = resolveVisualBackground(slide.styleRules, contract, visualSpec);
  const textColor = resolveTextColor(bg, contract);
  const accent = resolveAccent(contract, visualSpec);
  const mutedColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  const headline = getSlot(slide, 'headline');
  const body = getSlot(slide, 'body');
  const statNumber = getSlot(slide, 'stat_number');
  const statLabel = getSlot(slide, 'stat_label');
  const cta = getSlot(slide, 'cta');

  const leftChildren: object[] = [];
  if (statNumber) {
    leftChildren.push({
      type: 'div',
      props: {
        style: { fontSize: Math.min(contract.headingSize * 1.5, 100), fontWeight: 800, color: '#ffffff', lineHeight: 1, fontFamily: contract.headingFont },
        children: statNumber,
      },
    });
  }
  if (statLabel) {
    leftChildren.push({
      type: 'div',
      props: { style: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 12, lineHeight: 1.4 }, children: statLabel },
    });
  }

  const rightChildren: object[] = [];
  if (headline) {
    rightChildren.push({
      type: 'div',
      props: { style: { fontSize: contract.headingSize * 0.85, fontWeight: 700, color: textColor, lineHeight: contract.lineHeight, fontFamily: contract.headingFont }, children: headline },
    });
  }
  if (body) {
    rightChildren.push({
      type: 'div',
      props: { style: { fontSize: contract.bodySize, color: mutedColor, marginTop: 16, lineHeight: contract.lineHeight, fontFamily: contract.bodyFont }, children: body },
    });
  }
  if (cta) {
    rightChildren.push({
      type: 'div',
      props: { style: { marginTop: 24, fontSize: 15, fontWeight: 700, color: accent }, children: cta },
    });
  }
  if (slide.styleRules.showLogo && contract.logo?.base64) {
    rightChildren.push({
      type: 'img',
      props: { src: contract.logo.base64, style: { height: contract.logo.heightPx, objectFit: 'contain', marginTop: 'auto' } },
    });
  }

  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row', width, height, fontFamily: contract.bodyFont },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: accent, width: Math.round(width * 0.38), padding: contract.paddingX },
            children: leftChildren,
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, ...resolveVisualBackgroundStyle(slide.styleRules, contract, visualSpec), padding: `${contract.paddingY}px ${contract.paddingX}px` },
            children: rightChildren,
          },
        },
      ],
    },
  };
}
