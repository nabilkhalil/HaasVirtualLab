import { Component, type ReactNode } from 'react';

/** Keeps the controller usable if WebGL is unavailable or the 3D scene fails. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="scene nogl" data-testid="no-webgl">3D view unavailable (WebGL could not start). Controller still works.</div>
      : this.props.children;
  }
}
