# Layout System — VEED - Playground de IA
> Gerado pelo Process Cloner em 17/03/2026 20:37
> **REGRA**: Toda nova seção deve respeitar este sistema de grid e breakpoints.

---

## Tecnologias de layout identificadas

- Flexbox
- CSS Grid

**Container max-width**: `100%`

```css
.container {
  max-width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem;
}
```

## Breakpoints responsivos

| Breakpoint | Largura | Uso |
|------------|---------|-----|
| `530px` | 530px | Breakpoint |
| `600px` | 600px | Breakpoint |
| `896px` | 896px | Breakpoint |

### Template padrão de media queries

```css
@media (max-width: 530px) {
  /* ajustes para 530px */
}

@media (max-width: 600px) {
  /* ajustes para 600px */
}

@media (max-width: 896px) {
  /* ajustes para 896px */
}

```

## Grid columns identificados

```css
grid-template-columns: 1fr 1fr;
```

```css
grid-template-columns: 2fr 6fr;
```

## Padrões Flexbox

- `flex-direction: row`
- `flex-direction: column`

## Estrutura de seções HTML

```html
<header> .flex
<nav> .relative
<nav> .flex
<section>
<main> .app
```

## Template base de nova página

Use esta estrutura ao criar qualquer nova página:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página</title>
  <link rel="stylesheet" href="../styles/styles.css">
</head>
<body>
  <!-- HEADER -->
  <header><!-- navbar aqui --></header>

  <!-- MAIN -->
  <main>
    <!-- container max-width: 100% -->
    <div class="container">
      <!-- conteúdo aqui -->
    </div>
  </main>

  <!-- FOOTER -->
  <footer><!-- footer aqui --></footer>
  <script src="../scripts/main.js" defer></script>
</body>
</html>
```

---

*Process Cloner — 17/03/2026 20:37*