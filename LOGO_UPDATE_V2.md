# Logo Update V2 - Dynamic Theme Logos

## التحديث
استخدام شعارين منفصلين للثيمات الفاتحة والداكنة بدلاً من شعار واحد.

## الشعارات الجديدة

### 1. Light Logo
- **الملف**: `parkinzi-logo-light.png`
- **الاستخدام**: في الثيم الفاتح
- **التصميم**: حرف P بنمط الطريق مع خطوط هندسية

### 2. Dark Logo
- **الملف**: `parkinzi-logo-dark.png`
- **الاستخدام**: في الثيم الداكن
- **التصميم**: نفس التصميم مع ألوان مناسبة للخلفية الداكنة

## التطبيق

### HTML Structure
```html
<picture>
  <source srcset="parkinzi-logo-dark.png" media="(prefers-color-scheme: dark)">
  <img src="parkinzi-logo-light.png" alt="PARKINZI" class="hero-logo-img" id="heroLogo">
</picture>
```

### JavaScript Theme Switching
```javascript
function setTheme(t) {
  // ... existing code ...
  
  // Update logo based on theme
  const heroLogo = document.getElementById("heroLogo");
  if (heroLogo) {
    heroLogo.src = t === "dark" 
      ? "parkinzi-logo-dark.png" 
      : "parkinzi-logo-light.png";
  }
}
```

### CSS Styling
```css
.hero-logo-img {
  max-width: 500px;
  width: 85%;
  height: auto;
  margin: 0 auto 2.5rem;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  filter: drop-shadow(0 15px 35px rgba(0,140,242,0.2));
  animation: logoFloat 6s ease-in-out infinite;
}

[data-theme="dark"] .hero-logo-img {
  filter: drop-shadow(0 15px 35px rgba(0,204,255,0.25));
}

.hero-logo-img:hover {
  transform: translateY(-8px) scale(1.02);
  filter: drop-shadow(0 25px 50px rgba(0,140,242,0.3));
}

[data-theme="dark"] .hero-logo-img:hover {
  filter: drop-shadow(0 25px 50px rgba(0,204,255,0.35));
}
```

## Responsive Sizing

### Desktop
- `max-width: 500px`
- `width: 85%`

### Mobile (< 768px)
- `max-width: 400px`
- `width: 85%`

### Extra Small (< 360px)
- `max-width: 250px`
- `width: 80%`

### Landscape Mobile
- `max-width: 300px`
- `width: 70%`

## Animations

### Float Animation
```css
@keyframes logoFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
```
- **Duration**: 6 seconds
- **Easing**: ease-in-out infinite
- **Effect**: حركة عائمة ناعمة للأعلى والأسفل

### Hover Effect
- **Transform**: `translateY(-8px) scale(1.02)`
- **Shadow**: زيادة الظل لإعطاء عمق أكثر
- **Transition**: 0.5s cubic-bezier

## Drop Shadow

### Light Theme
- Normal: `drop-shadow(0 15px 35px rgba(0,140,242,0.2))`
- Hover: `drop-shadow(0 25px 50px rgba(0,140,242,0.3))`

### Dark Theme
- Normal: `drop-shadow(0 15px 35px rgba(0,204,255,0.25))`
- Hover: `drop-shadow(0 25px 50px rgba(0,204,255,0.35))`

## النتيجة

✅ شعار ديناميكي يتغير حسب الثيم
✅ تكامل سلس مع نظام الثيمات
✅ ظلال مناسبة لكل ثيم
✅ animations ناعمة ومحترفة
✅ responsive على جميع الشاشات
✅ performance optimized مع smooth transitions
