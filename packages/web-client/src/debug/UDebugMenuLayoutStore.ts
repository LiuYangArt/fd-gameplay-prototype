const DebugMenuLayoutStorageKey = "FD_DEBUG_MENU_LAYOUT_V1";
const DefaultViewportWidth = 1280;
const DefaultViewportHeight = 720;
const DefaultPanelWidth = 460;
const DefaultPanelHeight = 720;
const PanelPadding = 16;
const MinPanelWidth = 320;
const MinPanelHeight = 260;

export interface FDebugMenuLayoutState {
  X: number;
  Y: number;
  Width: number;
  Height: number;
}

interface FViewportSize {
  Width: number;
  Height: number;
}

export class UDebugMenuLayoutStore {
  public Load(): FDebugMenuLayoutState {
    const Viewport = this.GetViewportSize();
    const Fallback = this.CreateDefaultLayout(Viewport);
    if (!this.CanUseStorage()) {
      return Fallback;
    }

    const Raw = window.localStorage.getItem(DebugMenuLayoutStorageKey);
    if (!Raw) {
      return Fallback;
    }

    try {
      const Parsed = JSON.parse(Raw) as Partial<FDebugMenuLayoutState>;
      return this.ClampToViewport(this.SanitizeLayout(Parsed, Fallback), Viewport);
    } catch {
      return Fallback;
    }
  }

  public Save(Layout: FDebugMenuLayoutState): void {
    if (!this.CanUseStorage()) {
      return;
    }

    const Viewport = this.GetViewportSize();
    const ClampedLayout = this.ClampToViewport(Layout, Viewport);
    window.localStorage.setItem(DebugMenuLayoutStorageKey, JSON.stringify(ClampedLayout));
  }

  public ClampToViewport(
    Layout: FDebugMenuLayoutState,
    Viewport: FViewportSize = this.GetViewportSize()
  ): FDebugMenuLayoutState {
    const MaxWidth = Math.max(MinPanelWidth, Viewport.Width - PanelPadding * 2);
    const MaxHeight = Math.max(MinPanelHeight, Viewport.Height - PanelPadding * 2);
    const Width = this.Clamp(
      this.PickNumber(Layout.Width, DefaultPanelWidth),
      MinPanelWidth,
      MaxWidth
    );
    const Height = this.Clamp(
      this.PickNumber(Layout.Height, DefaultPanelHeight),
      MinPanelHeight,
      MaxHeight
    );
    const MaxX = Math.max(PanelPadding, Viewport.Width - Width - PanelPadding);
    const MaxY = Math.max(PanelPadding, Viewport.Height - Height - PanelPadding);
    const X = this.Clamp(this.PickNumber(Layout.X, PanelPadding), PanelPadding, MaxX);
    const Y = this.Clamp(this.PickNumber(Layout.Y, PanelPadding), PanelPadding, MaxY);

    return {
      X: Math.round(X),
      Y: Math.round(Y),
      Width: Math.round(Width),
      Height: Math.round(Height)
    };
  }

  private CreateDefaultLayout(Viewport: FViewportSize): FDebugMenuLayoutState {
    const Width = Math.min(
      DefaultPanelWidth,
      Math.max(MinPanelWidth, Viewport.Width - PanelPadding * 2)
    );
    const Height = Math.min(
      DefaultPanelHeight,
      Math.max(MinPanelHeight, Viewport.Height - PanelPadding * 2)
    );

    return this.ClampToViewport(
      {
        Width,
        Height,
        X: Viewport.Width - Width - PanelPadding,
        Y: PanelPadding
      },
      Viewport
    );
  }

  private SanitizeLayout(
    Input: Partial<FDebugMenuLayoutState> | undefined,
    Base: FDebugMenuLayoutState
  ): FDebugMenuLayoutState {
    return {
      X: this.PickNumber(Input?.X, Base.X),
      Y: this.PickNumber(Input?.Y, Base.Y),
      Width: this.PickNumber(Input?.Width, Base.Width),
      Height: this.PickNumber(Input?.Height, Base.Height)
    };
  }

  private GetViewportSize(): FViewportSize {
    if (typeof window === "undefined") {
      return {
        Width: DefaultViewportWidth,
        Height: DefaultViewportHeight
      };
    }

    return {
      Width: Math.max(window.innerWidth, 320),
      Height: Math.max(window.innerHeight, 320)
    };
  }

  private PickNumber(Value: unknown, Fallback: number): number {
    return typeof Value === "number" && Number.isFinite(Value) ? Value : Fallback;
  }

  private Clamp(Value: number, Min: number, Max: number): number {
    return Math.min(Math.max(Value, Min), Max);
  }

  private CanUseStorage(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }
}
