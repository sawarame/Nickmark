declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@primeuix/themes/aura' {
  const Aura: any;
  export default Aura;
}

declare module '*.css';
