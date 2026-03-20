// Shared define-element processor factory
// Bridges define-element CEs with sprae: clone template, collect <script> props, wire reactivity
//
// Usage: setupProcessor(sprae, shared, { extras?, onInit? })
// - shared: formatters, api, constants injected into every CE scope
// - extras: static properties merged into scope (e.g. _emit for list CEs)
// - onInit(sp, state): callback after sprae scope created (for state-dependent setup)
// - onPropChange(sp, k, v): callback on every prop change (for auto-open, URL sync, etc.)

export function setupProcessor(sprae, shared, { extras, onInit, onPropChange } = {}) {
  const DEL = customElements.get('define-element')
  if (!DEL) return

  DEL.processor = (root, state) => {
    if (root.template) root.appendChild(root.template.content.cloneNode(true))

    let own = {}
    for (let k of Object.getOwnPropertyNames(state.host))
      if (k !== 'props' && !k.startsWith('_de')) own[k] = state.host[k]

    let sp = sprae(root, {
      ...shared,
      emit: (name, detail) => setTimeout(() =>
        state.host.dispatchEvent(new CustomEvent(name, {
          detail: typeof detail === 'object' ? JSON.parse(JSON.stringify(detail)) : detail,
          bubbles: true
        }))),
      ...extras,
      ...own, ...state
    })

    for (let k in own) if (typeof own[k] === 'function') sp[k] = own[k].bind(sp)

    if (onInit) onInit(sp, state)

    let _ceHandler = state.host.onpropchange
    state.host.onpropchange = (k, v) => {
      sp[k] = v
      if (_ceHandler) _ceHandler.call(sp, k, v)
      if (onPropChange) onPropChange(sp, k, v)
    }

    return sp
  }
}
