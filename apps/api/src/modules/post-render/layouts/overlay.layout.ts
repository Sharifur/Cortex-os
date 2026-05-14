import { resolveTextColor, resolveAccent, resolveVisualBackground, resolveVisualBackgroundStyle, getSlot } from './layout-helpers';
import type { LayoutProps } from './layout.types';

export function overlayLayout({ slide, contract, width, height, backgroundImageBase64, visualSpec }: LayoutProps): object {
  const bg = backgroundImageBase64 ? 'transparent' : resolveVisualBackground(slide.styleRules, contract, visualSpec);
  const accent = resolveAccent(contract, visualSpec);
  const textColor = '#ffffff';
  const mutedColor = 'rgba(255,255,255,0.75)';
  const headline = getSlot(slide, 'headline');
  const body = getSlot(slide, 'body');
  const cta = getSlot(slide, 'cta');

  const contentChildren: object[] = [];
  if (headline) {
    contentChildren.push({
      type: 'div',
      props: {
        style: { fontSize: contract.headingSize, fontWeight: 800, color: textColor, lineHeight: contract.lineHeight, fontFamily: contract.headingFont },
        children: headline,
      },
    });
  }
  if (body) {
    contentChildren.push({
      type: 'div',
      props: {
        style: { fontSize: contract.bodySize, color: mutedColor, marginTop: 20, lineHeight: contract.lineHeight, fontFamily: contract.bodyFont },
        children: body,
      },
    });
  }
  if (cta) {
    contentChildren.push({
      type: 'div',
      props: {
        style: { marginTop: 32, padding: '10px 24px', backgroundColor: accent, color: '#fff', fontWeight: 700, fontSize: 16, borderRadius: 6, display: 'flex' },
        children: cta,
      },
    });
  }
  if (slide.styleRules.showLogo && contract.logo?.base64) {
    contentChildren.push({
      type: 'img',
      props: { src: contract.logo.base64, style: { height: contract.logo.heightPx, objectFit: 'contain', marginTop: 32 } },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        ...(backgroundImageBase64
          ? { backgroundImage: `url(${backgroundImageBase64})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : resolveVisualBackgroundStyle(slide.styleRules, contract, visualSpec)),
        fontFamily: contract.bodyFont,
      },
      children: [
        // Gradient overlay
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0) 100%)',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1, padding: `${contract.paddingY}px ${contract.paddingX}px` },
            children: contentChildren,
          },
        },
      ],
    },
  };
}
