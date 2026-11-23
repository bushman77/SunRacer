defmodule Sunracer.Trade.Market do
  @moduledoc """
  Green Starbase Trade Exchange fixed price book (credits per one-tonne unit).

  Prices are deliberately tight against the outfitter's price curve
  (`Sunracer.Outfitting.Shop`: 20,000-credit entry fittings): a full starter
  Sunracer hold (4 t) sells for roughly 300-1,800 credits, so even the
  cheapest fitting takes many profitable runs. Pricing is a balance
  baseline, not a reward source.

  Every good the exchange stocks costs more to buy than it fetches when sold
  (`@buy_markup`), so buying and selling back at the same desk always loses
  credits: there is no single-station arbitrage loop. Loot-only cargo (mail,
  salvage, research data and the like) can be sold but is never stocked.

  Client messages never carry a price; the server quotes from this module.
  """

  alias Sunracer.Cargo.Catalog

  # Sell prices: tight tier (about half of a 150/400/900 moderate baseline).
  @common 75
  @mid 200
  @rare 450
  # Buy price = sell price * 13/10, rounded up.
  @buy_markup {13, 10}

  @goods %{
    # Common
    "methane" => %{sell: @common, stocked: true},
    "hydrogen_cells" => %{sell: @common, stocked: true},
    "salvage" => %{sell: @common, stocked: false},
    "rock_samples" => %{sell: @common, stocked: false},
    "civilian_mail" => %{sell: @common, stocked: false},
    "patrol_supplies" => %{sell: @common, stocked: false},
    # Mid
    "titanium" => %{sell: @mid, stocked: true},
    "industrial_parts" => %{sell: @mid, stocked: true},
    "spare_parts" => %{sell: @mid, stocked: true},
    "brandy" => %{sell: @mid, stocked: true},
    "refined_minerals" => %{sell: @mid, stocked: true},
    "medical_supplies" => %{sell: @mid, stocked: false},
    # Rare
    "dilithium" => %{sell: @rare, stocked: true},
    "rare_ores" => %{sell: @rare, stocked: false},
    "industrial_machinery" => %{sell: @rare, stocked: false},
    "survey_equipment" => %{sell: @rare, stocked: false},
    "research_data" => %{sell: @rare, stocked: false}
  }

  # Fail the build if the price book and the cargo catalog ever disagree.
  catalog_ids = Catalog.all() |> Map.keys() |> Enum.sort()
  priced_ids = @goods |> Map.keys() |> Enum.sort()

  if catalog_ids != priced_ids do
    raise CompileError,
      description:
        "Trade.Market prices #{inspect(priced_ids -- catalog_ids)} unknown cargo " <>
          "and misses #{inspect(catalog_ids -- priced_ids)}"
  end

  @doc "Credits the exchange pays per unit, or an error for unknown cargo."
  @spec sell_price(term()) :: {:ok, pos_integer()} | {:error, :unknown_cargo}
  def sell_price(cargo_id) when is_binary(cargo_id) do
    case Map.fetch(@goods, cargo_id) do
      {:ok, %{sell: price}} -> {:ok, price}
      :error -> {:error, :unknown_cargo}
    end
  end

  def sell_price(_), do: {:error, :unknown_cargo}

  @doc "Credits the exchange charges per unit; only for stocked goods."
  @spec buy_price(term()) :: {:ok, pos_integer()} | {:error, :unknown_cargo | :not_stocked}
  def buy_price(cargo_id) when is_binary(cargo_id) do
    case Map.fetch(@goods, cargo_id) do
      {:ok, %{stocked: true, sell: sell}} -> {:ok, markup(sell)}
      {:ok, %{stocked: false}} -> {:error, :not_stocked}
      :error -> {:error, :unknown_cargo}
    end
  end

  def buy_price(_), do: {:error, :unknown_cargo}

  @doc """
  Every priced good with its catalog name, sell price and buy price (nil
  when not stocked), sorted by name for a stable console listing.
  """
  @spec listing() :: [map()]
  def listing do
    @goods
    |> Enum.map(fn {id, %{sell: sell, stocked: stocked}} ->
      {:ok, item} = Catalog.fetch(id)
      %{id: id, name: item.name, mass_tonnes: item.mass_tonnes,
        sell_price: sell, buy_price: if(stocked, do: markup(sell))}
    end)
    |> Enum.sort_by(& &1.name)
  end

  defp markup(sell) do
    {num, den} = @buy_markup
    div(sell * num + den - 1, den)
  end
end
