const withBase = (assetPath: string) => `${import.meta.env.BASE_URL}${assetPath}`;

export const hiresLogoUrl = withBase('hires-logo.svg');
export const hiresAudioBadgeUrl = withBase('hires-audio.svg');
