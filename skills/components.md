# Catálogo de Componentes — VEED - Playground de IA
> Gerado pelo Process Cloner em 17/03/2026 20:37
> **REGRA**: Ao criar um componente existente neste catálogo, use
> exatamente as classes CSS documentadas. Não invente nomes de classe.

---

**4 componentes identificados:**

- Navbar
- Botões / CTA
- Grid de imagens
- Badges / Tags

---

## Navbar

**Classes CSS principais:**

- `.relative`
- `.z-100`
- `.flex-1`
- `.justify-center`
- `.m-auto`
- `.flex`

**Estrutura HTML:**

```html
<nav class="relative z-100 flex-1 justify-center m-auto flex max-w-max items-center gap-0.5 ">
  <div class="nav-brand">Logo</div>
  <ul class="nav-links">
    <li><a href="#">Link</a></li>
  </ul>
</nav>
```

---

## Botões / CTA

**Classes CSS principais:**

- `.flex`
- `.items-center`
- `.justify-center`
- `.gap-2`
- `.rounded-xl`
- `.p-2.5`

**Estrutura HTML:**

```html
<button class="flex items-center justify-center gap-2 rounded-xl p-2.5 font">Rótulo</button>
```

---

## Grid de imagens

**Classes CSS principais:**

- `.mx-auto`
- `.mb-4`
- `.flex`
- `.flex-row`
- `.flex-nowrap`
- `.justify-center`

**Estrutura HTML:**

```html
<div class="mx-auto mb-4 flex flex-row flex-nowrap justify-center">
  <img src="images/img_1.jpg" alt="Imagem 1">
  <img src="images/img_2.jpg" alt="Imagem 2">
  <img src="images/img_3.jpg" alt="Imagem 3">
</div>
```

---

## Badges / Tags

**Classes CSS principais:**

- `.grecaptcha-badge`
- `.inline_a3739bb3`

**Estrutura HTML:**

```html
<span class="grecaptcha-badge inline_a3739bb3">Rótulo</span>
```

---

*Process Cloner — 17/03/2026 20:37*