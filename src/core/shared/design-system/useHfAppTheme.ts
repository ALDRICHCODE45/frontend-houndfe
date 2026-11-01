import { onBeforeMount, onUnmounted } from 'vue'

/** App owns the body boundary so body-targeted teleports inherit the same HF
 * roles as routed content. Importing the stylesheet alone remains opt-in. */
export function useHfAppTheme() {
  const owned: string[] = []
  onBeforeMount(() => {
    for (const marker of ['hf-theme', 'hf-ui', 'hf-app']) {
      if (document.body.classList.contains(marker)) continue
      document.body.classList.add(marker)
      owned.push(marker)
    }
  })
  onUnmounted(() => {
    document.body.classList.remove(...owned)
  })
}
