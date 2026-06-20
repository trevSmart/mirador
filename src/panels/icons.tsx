import type { SVGProps } from 'react'

function PanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export function HomePanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <PanelIcon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </PanelIcon>
  )
}

export function AgentsPanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <PanelIcon {...props}>
      <path d="M16 19a4 4 0 0 0-8 0" />
      <circle cx="12" cy="8" r="3.5" />
      <path d="M19 19a3 3 0 0 0-2.2-2.9" />
      <path d="M5 19a3 3 0 0 1 2.2-2.9" />
    </PanelIcon>
  )
}

export function QueuesPanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <PanelIcon {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </PanelIcon>
  )
}

export function SkillsPanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <PanelIcon {...props}>
      <path d="M12 3 14.5 8.5 20.5 9.2 16 13.1 17.2 19 12 16.1 6.8 19 8 13.1 3.5 9.2 9.5 8.5Z" />
    </PanelIcon>
  )
}

export function WorkPanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <PanelIcon {...props}>
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M4 12h16" />
    </PanelIcon>
  )
}
