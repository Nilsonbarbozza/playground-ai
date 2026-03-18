# UX Patterns — VEED - Playground de IA
> Gerado pelo Process Cloner em 17/03/2026 20:37
> **REGRA**: Preserve estes comportamentos em todas as interações.
> Eles definem a personalidade e o feel do produto.

---

## Comportamento de scroll e navegação

- Scroll suave: `sim`
- Elementos sticky (navbar/sidebar): `sim`

```css
html { scroll-behavior: smooth; }
```

## Animações (@keyframes)

- `@keyframes slideFromTop`
- `@keyframes slide-bounce-2`
- `@keyframes slide-out-2`
- `@keyframes slide-bounce-1`
- `@keyframes onetrust-fade-in`
- `@keyframes slide-bounce-3`

**Durações de animação detectadas**: `1.25s`, `0.2s`, `0.6s`, `0s`

## Transições CSS

```css
transition: max-height 0.3s ease-in-out,
    opacity 0.5s ease-in;
transition: transform 250ms cubic-bezier(0.33, 0, 0, 1);
transition: width 0.5s;
transition: right 0.3s;
transition: transform 0.25s ease-out,
    opacity 0.2s ease-out 0.05s;
```

## Estados :hover

```css
faultScrollbar)::-webkit-scrollbar-track:hover {
  background: var(--colors-base-color);
}
```

```css
faultScrollbar)::-webkit-scrollbar-thumb:hover {
  background-color: var(--colors-light-grey);
}
```

```css
input:-webkit-autofill:hover {
  transition: background-color 5000s ease-in-out;
  -webkit-box-shadow: inset 0 0 0 1000px #fff;
}
```

```css
textarea:-webkit-autofill:hover {
  transition: background-color 5000s ease-in-out;
  -webkit-box-shadow: inset 0 0 0 1000px #fff;
}
```

## Estados :focus (acessibilidade)

```css
input:-webkit-autofill:focus {
  transition: background-color 5000s ease-in-out;
  -webkit-box-shadow: inset 0 0 0 1000px #fff;
}
```

```css
textarea:-webkit-autofill:focus {
  transition: background-color 5000s ease-in-out;
  -webkit-box-shadow: inset 0 0 0 1000px #fff;
}
```

```css
select:-webkit-autofill:focus {
  transition: background-color 5000s ease-in-out;
  -webkit-box-shadow: inset 0 0 0 1000px #fff;
}
```

```css
.focus\:border-none:focus {
  --tw-border-style: none;
  border-style: none;
}
```

## Diretrizes de UX para novas funcionalidades

Ao adicionar novos elementos, siga estas regras extraídas do design original:

1. **Consistência de interação** — use as mesmas durações de transição já definidas
2. **Feedback visual** — todo elemento clicável deve ter estado :hover documentado acima
3. **Acessibilidade** — mantenha estados :focus visíveis conforme padrão do projeto
4. **Mobile first** — valide o comportamento nos breakpoints documentados em `layout-system.md`

---

*Process Cloner — 17/03/2026 20:37*