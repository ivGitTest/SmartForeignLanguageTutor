/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#243b39',
    tint: '#315f53',

    // Core surfaces
    background: '#f5f8f3',
    foreground: '#243b39',

    // Cards / elevated surfaces
    card: '#fffefa',
    cardForeground: '#243b39',

    // Primary action color (buttons, links, active states)
    primary: '#315f53',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#dcebe1',
    secondaryForeground: '#315f53',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#eaf2eb',
    mutedForeground: '#647774',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f8e9df',
    accentForeground: '#8d4f40',

    // Destructive actions (delete, error states)
    destructive: '#9d463a',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#dce6df',
    input: '#dce6df',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 20,
};

export default colors;
