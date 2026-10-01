(() => { const a = window.__app, g = a.game, cam = a.renderer.xr.getCamera();
  const v = (o) => o.toArray().map((x) => +x.toFixed(2));
  return { t: +g.time.toFixed(1), menuOpen: a.menuOpen, menuPos: v(a.menu.mesh.position), head: v(cam.getWorldPosition(cam.position.clone())), board: v(a.world.board.position), placed: a.placedXR,
    workers: g.units.filter((u) => u.team === 0).map((u) => u.order.type + (u.hidden ? 'H' : '')).join(','), ptrs: a.pointers.map((p) => [p.inputSource?.handedness, p.isHand, p.hasJoints]) }; })()
