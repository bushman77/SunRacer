defmodule SunracerWeb.TitleSettings do
  @moduledoc "Compact, extensible settings menu for public browser screens."
  use SunracerWeb, :html

  def menu(assigns) do
    ~H"""
    <div class="nova-settings">
      <button
        id="nova-settings-toggle"
        type="button"
        class="nova-settings-toggle"
        popovertarget="nova-settings-panel"
        aria-label="Settings"
        title="Settings"
      >
        <.icon name="hero-bars-3" class="size-6" />
      </button>
      <section id="nova-settings-panel" class="nova-settings-panel" popover="auto" aria-label="Settings">
        <details id="nova-network-settings" class="nova-settings-section">
          <summary>
            <.icon name="hero-signal" class="size-5" />
            <span>Network settings</span>
            <.icon name="hero-chevron-down" class="nova-settings-chevron size-4" />
          </summary>
          <div class="nova-network-content">
            <dl>
              <dt>Server</dt>
              <dd id="nova-network-origin">Current website</dd>
              <dt>Connection mode</dt>
              <dd>Browser-managed</dd>
            </dl>
            <button id="nova-network-test" class="nova-network-test" type="button">Test connection</button>
            <p id="nova-network-status" class="nova-network-status" role="status"></p>
            <p class="nova-network-note">
              Configure proxy settings in your browser or operating system.
              The desktop launcher has its own networking controls.
            </p>
          </div>
        </details>
      </section>
    </div>
    """
  end
end
