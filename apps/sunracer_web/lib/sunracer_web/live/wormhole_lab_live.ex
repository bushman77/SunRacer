defmodule SunracerWeb.WormholeLabLive do
  @moduledoc "Development-only isolated flight simulator; never modifies a pilot."
  use SunracerWeb, :live_view
  alias Core.Universe.WormholeTransit, as: Transit

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, transit: nil, geometry: Jason.encode!(Transit.geometry()))}
  end

  @impl true
  def handle_event("start_transit", _params, %{assigns: %{transit: nil}} = socket) do
    send(self(), :transit_tick)
    {:noreply, assign(socket, transit: Transit.new())}
  end
  def handle_event("start_transit", _, %{assigns: %{transit: state}} = socket) do
    case Transit.retry(state) do
      {:ok, next} ->
        send(self(), :transit_tick)
        {:noreply, assign(socket, transit: next)}
      {:error, :reentry_unavailable} -> {:noreply, socket}
    end
  end
  def handle_event("transit_controls", input, %{assigns: %{transit: state}} = socket)
      when is_map(state) do
    {:noreply, assign(socket, transit: Transit.controls(state, input))}
  end
  def handle_event("transit_controls", _, socket), do: {:noreply, socket}
  def handle_event("abort_transit", _, %{assigns: %{transit: state}} = socket)
      when is_map(state) do
    {:noreply, assign(socket, transit: Transit.abort(state))}
  end
  def handle_event("abort_transit", _, socket), do: {:noreply, socket}

  @impl true
  def handle_info(:transit_tick, %{assigns: %{transit: state}} = socket) when is_map(state) do
    next = Transit.tick(state)
    if Transit.ticking?(next), do: Process.send_after(self(), :transit_tick, Transit.step_ms())
    {:noreply, assign(socket, transit: next)}
  end
  def handle_info(:transit_tick, socket), do: {:noreply, socket}

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <section class="wormhole-lab">
        <h1>SPACE<span>NOVA</span> / WORMHOLE FLIGHT LAB</h1>
        <p>SOL → ALPHA CENTAURI · ISOLATED DEVELOPMENT SIMULATION</p>
        <p>W/S pitch · A/D steer · Q/E roll · =/− throttle. Exposure bypasses shields.</p>
        <div id="wormhole-lab" phx-hook="WormholeLab"
             data-geometry={@geometry}
             data-transit={Jason.encode!(if(@transit, do: Transit.public(@transit), else: nil))}>
          <div id="wormhole-lab-renderer" phx-update="ignore"></div>
          <%= if @transit do %>
            <div class="wormhole-lab-telemetry">
              <strong>{String.upcase(to_string(@transit.status))}</strong>
              <span>HULL {@transit.hull}/{@transit.max_hull}</span>
              <span>SHIELD {@transit.shields}/{@transit.max_shields}</span>
              <span>EXPOSURE {Float.round(@transit.elapsed_ms / 1000, 1)}s</span>
              <span>DIRECT DAMAGE {Float.round(Transit.public(@transit).damage_rate, 1)} HP/s</span>
              <span>PROGRESS {round(Transit.public(@transit).progress * 100)}%</span>
              <span>THROTTLE {round(@transit.input.throttle * 100)}%</span>
              <span :if={@transit.wall_contact} class="wormhole-danger">WALL CONTACT</span>
              <strong :if={@transit.outside and @transit.status == :in_transit}
                      class="wormhole-danger" role="alert">
                BOUNDARY BREACH · STEER BACK INSIDE · EJECTION IN
                {Float.round(Transit.public(@transit).breach_remaining_ms / 1000, 1)}s
              </strong>
            </div>
            <button :if={@transit.status == :in_transit} phx-click="abort_transit" type="button">Abort transit</button>
            <p :if={@transit.status == :arrived}>Alpha Centauri exit reached. Simulation complete; no pilot transfer performed.</p>
            <p :if={@transit.status == :destroyed}>Hull destroyed by wormhole exposure.</p>
            <p :if={@transit.status in [:ejected, :aborted]}>
              Returned to SOL entrance. All simulated hull damage retained.
            </p>
            <p :if={@transit.cooldown_ms > 0}>
              RE-ENTRY COOLDOWN {Float.round(@transit.cooldown_ms / 1000, 1)}s
            </p>
            <button :if={@transit.status in [:ejected, :aborted]} phx-click="start_transit"
                    disabled={@transit.cooldown_ms > 0} type="button">
              Re-enter with current hull
            </button>
            <a :if={@transit.status in [:arrived, :destroyed, :ejected, :aborted]} href="/dev/wormhole">
              Reset lab (new simulated ship)
            </a>
          <% else %>
            <button phx-click="start_transit" type="button">Enter wormhole</button>
          <% end %>
        </div>
      </section>
    </Layouts.app>
    """
  end
end
