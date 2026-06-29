# Plan tree: 3D space thumbnails

## Goal

In the new `SpacePlanTree` (the from-scratch places/plants list), each plant node
shows a thumbnail of its actual `SpaceView3D` render instead of the static
`business_unit` icon. The thumbnail shows the room (cells, walls, windows, light)
with agents drawn as **ground-level avatars without towers**, non-interactive,
and lazily mounted. Plant nodes get much more vertical spacing to fit the render.

## Scope

Visual change layered on the existing `SpaceView3D`. The only logic added is the
no-tower drawing branch. No change to the model or to the existing
`SpaceSidebar`.

## 1. `SpaceView3D` — two new opt-in props

Both optional, defaults preserve every current usage (`SpacePanel`,
`SpaceEditorPanel` preview).

- `towers?: boolean` (default `true`). When `false`, `IsoSeat` skips
  `segmentedTowerFaces` and draws the avatar at ground level (`y`, not `y - h`).
  The saturation glow/beacon reposition to the ground avatar. No tower geometry.
- `interactive?: boolean` (default `true`). When `false`: no orbit/drag pointer
  handlers, no tooltips, no hover-avatar overlay, no rotation persistence
  (`saveRoomRotation` never called). Rotation is the default from
  `loadRoomRotation(space.id)`. Cursor stays normal. `onSelectAgent` is never
  invoked.

## 2. `SpacePlanThumb` (new component)

Isolates cost and lazy mounting.

- Props: `space`, `agentsById`, `queuesById`.
- A fixed-size container with a `ref`; an `IntersectionObserver` mounts the
  `SpaceView3D` only once visible. Before that, an empty placeholder of the same
  size (no layout shift).
- When visible: `<SpaceView3D space agentsById queuesById showAvatars
  towers={false} interactive={false} animations={false} onSelectAgent={noop} />`,
  inside a container sized to the thumbnail (CSS, `pointer-events: none`).
- `SpaceView3D` keeps being imported via `lazy()` (as the panels already do).

## 3. `SpacePlanTree`

- Two new props: `agentsById`, `queuesById`.
- Each `__space` row replaces `<SfIcon name="space" />` with
  `<SpacePlanThumb space agentsById queuesById />`.
- The place icon (`address`) is unchanged.

## 4. `SpaceEditorPanel`

- Pass `agentsById` and `queuesById` (already computed there) into
  `<SpacePlanTree />`.

## 5. CSS

- Much larger vertical gap between `__space` rows to fit the ~96px-tall render.
- `.fe-plan-tree__thumb`: fixed size (~96px tall), `overflow: hidden`,
  `pointer-events: none`; inner `fv3d-wrap`/`fv3d-svg` fit the container.
- Reposition the right-angle connectors so the horizontal elbow meets the
  vertical centre of the thumbnail (no longer a small icon).

## Testing

No unit tests: this is visual rendering over an existing component. The new
`towers=false` branch is pure painting.
