# Design Tokens — VEED - Playground de IA

> Gerado pelo Process Cloner em 17/03/2026 20:37
> **REGRA PRINCIPAL**: Nunca invente ou substitua estes valores.
> Toda cor, fonte e espaçamento do projeto deve vir exclusivamente deste arquivo.

---

## Paleta de cores

### Variáveis CSS (use estas em todo o código)

```css
:root {
  --tw-border-style: none;
  --tw-shadow-color: color-mix(
    in oklab,
    color-mix(in oklab, var(--color-black) 20%, transparent)
      var(--tw-shadow-alpha),
    transparent
  );
  --tw-inset-shadow-color: initial;
  --tw-ring-color: var(--color-primary);
  --tw-inset-ring-color: initial;
  --tw-ring-offset-color: var(--color-background);
  --tw-drop-shadow-color: initial;
  --color-red-50: oklch(96.9%.015 17.4);
  --color-red-100: oklch(93.4%.033 17.8);
  --color-red-200: oklch(87.9%.064 18.4);
  --color-red-300: oklch(80.2%.114 19.9);
  --color-red-400: oklch(68.1%.207 24.5);
  --color-red-500: oklch(64.3%.224 26.3);
  --color-red-600: oklch(58.8%.228 28.1);
  --color-red-700: oklch(51.6%.202 28.2);
  --color-red-800: oklch(45.2%.173 27.8);
  --color-red-900: oklch(40%.143 26.6);
  --color-red-950: oklch(26.1%.095 27);
  --color-orange-300: oklch(83.7%.128 66.29);
  --color-orange-400: oklch(75%.183 55.934);
}
```

### Uso semântico

- **primary**: #5666F5
- **background**: #0000
- **text**: #FFFFFF
- **border**: #5457FF
- **success**: #159365
- **error**: #FB3377

### Cores por frequência de uso

| #   | Cor     | Uso        |
| --- | ------- | ---------- |
| 1   | #FFFFFF | 81x no CSS |
| 2   | #6D6D6D | 28x no CSS |
| 3   | #000000 | 16x no CSS |
| 4   | #333333 | 11x no CSS |
| 5   | #888888 | 8x no CSS  |
| 6   | #F60859 | 8x no CSS  |
| 7   | #35916A | 7x no CSS  |
| 8   | #5CCD9E | 7x no CSS  |

## Tipografia

### Variáveis de fonte

```css
:root {
  --tw-font-weight: var(--font-weight-bold);
  --font-sans:
    ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol", "Noto Color Emoji";
  --font-mono:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  --font-weight-thin: 100;
  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
  --font-weight-black: 900;
  --default-font-family: var(--font-sans);
  --default-mono-font-family: var(--font-mono);
  --font-body: "Inter", sans-serif;
  --font-heading: "SwissNow", sans-serif;
  --font-baseneue: "BaseNeue", sans-serif;
  --font-librebaskerville: "LibreBaskerville";
}
```

### Famílias de fonte

- `OpenSans` — Principal
- `Montserrat` — Display/Títulos
- `Inter` — Auxiliar
- `Roboto` — Auxiliar

### Hierarquia tipográfica

```css
p {
  font-size: 12px;
}
small {
  font-size: 11px;
}
```

**Pesos utilizados**: `400`, `500`, `600`, `700`, `bold`

## Espaçamentos e dimensões

### Variáveis de espaçamento

```css
:root {
  --tw-space-y-reverse: 0;
  --tw-space-x-reverse: 0;
  --tw-drop-shadow-size: initial;
  --tw-contain-size: initial;
  --radius-xs: 0.125rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-3xl: 1.5rem;
  --radius-4xl: 2rem;
}
```

**Paddings mais usados**: `10px`, `16px`, `24px`, `20px`, `12px`, `40px`

**Gaps (grid/flex)**: `8px`, `14px`, `4px`, `16px`, `20px`, `2px`

**Border-radius**: `25px`, `15px`, `8px`

### Box shadows

```css
box-shadow: none;
box-shadow: inset 0 0 0 1000px #fff;
box-shadow: inset 0 0 0 1000px #fff;
```

---

_Process Cloner — 17/03/2026 20:37_
