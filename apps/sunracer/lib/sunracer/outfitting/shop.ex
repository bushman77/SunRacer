defmodule Sunracer.Outfitting.Shop do
  @moduledoc """
  Green Starbase outfitter's fixed credit price book.

  The progression price curve ranges from 20,000-credit entry fittings to
  35,000,000-credit late-game shields. The first-run delivery pays only 500
  credits once; these prices require future repeatable economic gameplay. Client messages never include a price or a purchase quantity.
  Only the listed catalog IDs are available; stock is not an exploitable
  client-controlled value. Pricing is a balance baseline, not a reward source.
  """

  alias Core.Equipment.Catalog

  @prices %{
    "beryl" => 35_000,
    "sapphire" => 150_000,
    "lf1" => 500_000,
    "lf2" => 2_000_000,
    "lf3" => 8_000_000,
    "lf4" => 25_000_000,
    "g1" => 20_000,
    "g2" => 100_000,
    "g3" => 400_000,
    "sg1" => 250_000,
    "sg2" => 1_250_000,
    "bo2" => 35_000_000
  }

  @spec price(String.t()) :: {:ok, pos_integer()} | {:error, :not_for_sale}
  def price(item_id) when is_binary(item_id) do
    case Map.fetch(@prices, item_id) do
      {:ok, price} ->
        case Catalog.fetch(item_id) do
          {:ok, _} -> {:ok, price}
          :error -> {:error, :not_for_sale}
        end

      :error ->
        {:error, :not_for_sale}
    end
  end
  def price(_), do: {:error, :not_for_sale}

  @spec quote(String.t()) :: {:ok, map()} | {:error, :not_for_sale}
  def quote(item_id) do
    with {:ok, price} <- price(item_id),
         {:ok, item} <- Catalog.fetch(item_id) do
      {:ok, %{id: item.id, name: item.name, price: price}}
    end
  end

  @spec stock() :: [map()]
  def stock do
    Catalog.all()
    |> Enum.flat_map(fn item ->
      case price(item.id) do
        {:ok, cost} ->
          [%{id: item.id, name: item.name,
             category: Atom.to_string(item.category), price: cost,
             damage: item.damage, speed: item.speed,
             shields: item.shields, shield_absorption: item.shield_absorption,
             shield_regeneration: item.shield_regeneration}]
        _ -> []
      end
    end)
  end
end
