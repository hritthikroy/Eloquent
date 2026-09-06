/* eslint-disable import/no-unresolved */
/**
 * PromoModal Component (JSX)
 *
 * Surfaces curated "Hila Nina" promotional content in a bilingual
 * (English/Bengali) modal styled to match Eloquent's ambient dark theme.
 * Features optional album artwork with graceful fallback, language toggle,
 * audio streaming integration, and error toast alerts.
 */

let React = null;
try {
  React = require('react');
} catch (e) {
  React = {
    useState: (init) => {
      let val = typeof init === 'function' ? init() : init;
      const setter = (newVal) => {
        val = typeof newVal === 'function' ? newVal(val) : newVal;
      };
      return [val, setter];
    },
    useEffect: (fn) => {
      if (typeof fn === 'function') fn();
    },
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
}

const { useState, useEffect, useCallback } = React;

const DEFAULT_PROMO = {
  id: 'hila-nina-promo',
  title: 'Hila Nina',
  artist: 'Hila Nina & The Ambient Collective',
  description: {
    en: 'Experience the soulful harmonies of Hila Nina, blending classical acoustics with contemporary ambient rhythm.',
    bn: 'হিলা নিনার হৃদয়স্পর্শী সুর উপভোগ করুন, যেখানে শাস্ত্রীয় রাগ ও আধুনিক অ্যাম্বিয়েন্ট সঙ্গীতের মেলবন্ধন ঘটেছে।',
  },
  imageUrl: 'https://assets.eloquent.internal/art/hila-nina.jpg',
  streamUrl: 'https://stream.eloquent.internal/audio/hila-nina-master.mp3',
  ctaText: {
    en: 'Listen together',
    bn: 'একসাথে শুনুন',
  },
  duration: '3:45',
};

function PromoModal({
  isOpen = false,
  onClose = () => {},
  onPlay = () => {},
  promoData = null,
  initialLang = 'en',
}) {
  const [lang, setLang] = useState(initialLang || 'en');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const data = promoData || DEFAULT_PROMO;

  // Language fallback: If selected language description is empty or missing, fallback to English
  const localizedDesc = (data.description && data.description[lang])
    || (data.description && data.description.en)
    || (typeof data.description === 'string' ? data.description : '');

  const localizedCta = (data.ctaText && data.ctaText[lang])
    || (data.ctaText && data.ctaText.en)
    || (typeof data.ctaText === 'string' ? data.ctaText : 'Listen together');

  const title = data.title || 'Hila Nina';
  const artist = data.artist || 'Special Feature';
  const hasArtwork = Boolean(data.imageUrl && !hasImageError);

  const handlePlayClick = useCallback(() => {
    if (!data.streamUrl || typeof data.streamUrl !== 'string' || data.streamUrl.trim() === '') {
      setErrorMessage(
        lang === 'bn'
          ? 'অডিও স্ট্রিমিং লিঙ্ক পাওয়া যায়নি।'
          : 'Streaming audio URL is missing or unavailable.',
      );
      return;
    }

    try {
      setErrorMessage('');
      setIsPlaying(true);
      if (typeof onPlay === 'function') {
        onPlay(data.streamUrl, data);
      }
    } catch (err) {
      setIsPlaying(false);
      setErrorMessage(err.message || 'Failed to start playback');
    }
  }, [data, lang, onPlay]);

  // Keyboard navigation: Close on Escape
  useEffect(() => {
    if (!isOpen) return () => {};
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return () => {};
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'eloquent-promo-backdrop',
      id: 'promo-modal-backdrop',
      onClick: (e) => {
        if (e.target && e.target.id === 'promo-modal-backdrop') {
          onClose();
        }
      },
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 13, 0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
        animation: 'fadeIn 0.25s ease-out',
      },
    },
    React.createElement(
      'div',
      {
        className: 'eloquent-promo-card',
        id: 'promo-modal-container',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'promo-modal-title',
        style: {
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'rgba(18, 20, 32, 0.94)',
          border: '1px solid rgba(139, 92, 246, 0.32)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65), 0 0 32px rgba(139, 92, 246, 0.2)',
          borderRadius: '20px',
          padding: '28px',
          color: '#F3F4F6',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        },
      },
      // Header: Badge + Language Toggle + Close button
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(139, 92, 246, 0.18)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#A78BFA',
            },
          },
          React.createElement('span', null, '✦'),
          React.createElement('span', null, 'Featured Promo'),
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          // Language Switcher
          React.createElement(
            'div',
            {
              className: 'eloquent-lang-toggle',
              style: {
                display: 'inline-flex',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '2px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
            },
            React.createElement(
              'button',
              {
                id: 'promo-lang-en',
                type: 'button',
                onClick: () => setLang('en'),
                style: {
                  background: lang === 'en' ? 'rgba(139, 92, 246, 0.8)' : 'transparent',
                  color: lang === 'en' ? '#FFFFFF' : '#9CA3AF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                },
              },
              'EN',
            ),
            React.createElement(
              'button',
              {
                id: 'promo-lang-bn',
                type: 'button',
                onClick: () => setLang('bn'),
                style: {
                  background: lang === 'bn' ? 'rgba(139, 92, 246, 0.8)' : 'transparent',
                  color: lang === 'bn' ? '#FFFFFF' : '#9CA3AF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                },
              },
              'বাংলা',
            ),
          ),
          // Close button
          React.createElement(
            'button',
            {
              id: 'promo-modal-close-btn',
              type: 'button',
              'aria-label': 'Close promotional modal',
              onClick: onClose,
              style: {
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#9CA3AF',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.15s ease',
              },
            },
            '✕',
          ),
        ),
      ),
      // Album Artwork / Placeholder
      React.createElement(
        'div',
        {
          style: {
            width: '100%',
            height: '180px',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          },
        },
        hasArtwork
          ? React.createElement('img', {
            src: data.imageUrl,
            alt: title,
            onError: () => setHasImageError(true),
            id: 'promo-album-artwork',
            style: {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            },
          })
          : React.createElement(
            'div',
            {
              id: 'promo-artwork-placeholder',
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#8B5CF6',
                background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(15,17,26,0.8) 100%)',
                width: '100%',
                height: '100%',
              },
            },
            React.createElement(
              'div',
              {
                style: {
                  fontSize: '36px',
                  filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.5))',
                },
              },
              '♫',
            ),
            React.createElement(
              'span',
              {
                style: {
                  fontSize: '12px',
                  color: '#9CA3AF',
                  letterSpacing: '0.04em',
                },
              },
              'Eloquent Audio Showcase',
            ),
          ),
      ),
      // Track Title & Artist
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        React.createElement(
          'h2',
          {
            id: 'promo-modal-title',
            style: {
              margin: 0,
              fontSize: '22px',
              fontWeight: '700',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            },
          },
          title,
        ),
        React.createElement(
          'p',
          {
            style: {
              margin: 0,
              fontSize: '13px',
              color: '#A78BFA',
              fontWeight: '500',
            },
          },
          artist,
        ),
      ),
      // Description with bilingual fallback
      React.createElement(
        'p',
        {
          id: 'promo-modal-description',
          style: {
            margin: 0,
            fontSize: '14px',
            lineHeight: '1.55',
            color: '#D1D5DB',
          },
        },
        localizedDesc,
      ),
      // Error Toast Alert
      errorMessage
        ? React.createElement(
          'div',
          {
            id: 'promo-error-toast',
            style: {
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '10px',
              color: '#FCA5A5',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            },
          },
          React.createElement('span', null, '⚠️'),
          React.createElement('span', null, errorMessage),
        )
        : null,
      // CTA Button ("Listen together" / "Play")
      React.createElement(
        'button',
        {
          id: 'promo-cta-play-btn',
          type: 'button',
          onClick: handlePlayClick,
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            padding: '14px 20px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
            transition: 'all 0.2s ease',
          },
        },
        React.createElement('span', null, isPlaying ? '❚❚' : '▶'),
        React.createElement('span', null, localizedCta),
      ),
    ),
  );
}

PromoModal.DEFAULT_PROMO = DEFAULT_PROMO;
module.exports = PromoModal;
module.exports.PromoModal = PromoModal;
