defmodule Sunracer.Trade do
  @moduledoc """
  Tarek Sol's Trade Exchange: sell cargo from the hold for credits, or buy
  stocked cargo with credits, at `Sunracer.Trade.Market` fixed prices.

  Each trade is one DB transaction. The account row is locked first and the
  inventory row second (the global Account -> equipment lock order shared
  with `Sunracer.Piracy` and `Sunracer.Inventory`), so concurrent trades,
  seizures and purchases serialize instead of double-spending. Credits and
  cargo commit or roll back together. The client supplies only a cargo id
  and a whole-unit amount; prices, balances, mass and capacity are server
  values. Callers (`Sunracer.World`) run these inside the MapServer
  station-transaction callback, which proves the pilot is docked, alive and
  standing at the Trade Exchange kiosk.
  """

  import Ecto.Query, warn: false

  alias Core.Ships.Catalog, as: ShipCatalog
  alias Sunracer.{Inventory, Repo}
  alias Sunracer.Accounts.PlayerAccount
  alias Sunracer.Cargo.Catalog, as: CargoCatalog
  alias Sunracer.Trade.Market

  # Larger than any hold (Leonov: 500 t); bounds client input.
  @max_units 1_000

  @doc "Largest whole-unit amount a single trade request may name."
  def max_units, do: @max_units

  @doc "Read-only exchange view: credits, hold usage and the price board."
  @spec snapshot(pos_integer()) :: {:ok, map()} | {:error, term()}
  def snapshot(player_id) when is_integer(player_id) do
    with %PlayerAccount{} = account <- Repo.get(PlayerAccount, player_id),
         {:ok, ship} <- ShipCatalog.fetch(account.ship_id) do
      manifest = Inventory.cargo_manifest(player_id)

      goods =
        Market.listing()
        |> Enum.map(&Map.put(&1, :quantity, held(manifest, &1.id)))
        # Show what the pilot holds plus what the exchange stocks.
        |> Enum.filter(&(&1.quantity > 0 or &1.buy_price != nil))

      {:ok,
       %{credits: account.credits,
         hold: %{capacity: ship.cargo_capacity,
           used: Inventory.cargo_tonnage(player_id)},
         goods: goods}}
    else
      nil -> {:error, :account_not_found}
      {:error, _} = error -> error
    end
  end

  def snapshot(_), do: {:error, :account_not_found}

  @doc """
  Sell `amount` units of `cargo_id` from the hold at the exchange's price.
  Only quantities the server confirms are aboard can be sold.
  """
  def sell(player_id, cargo_id, amount) do
    with :ok <- valid_request(player_id, cargo_id, amount),
         {:ok, price} <- Market.sell_price(cargo_id) do
      total = price * amount

      Repo.transaction(fn ->
        with %PlayerAccount{} = account <- lock_account(player_id),
             {:ok, _hold} <- Inventory.remove_cargo(player_id, cargo_id, amount),
             {:ok, updated} <- credit(account, total),
             {:ok, view} <- snapshot(player_id) do
          %{exchange: view,
            receipt: receipt("sold", cargo_id, amount, price, total, updated)}
        else
          nil -> Repo.rollback(:account_not_found)
          {:error, reason} -> Repo.rollback(reason)
          _ -> Repo.rollback(:invalid_trade)
        end
      end)
    end
  end

  @doc """
  Buy `amount` units of a stocked good. Requires enough credits and free
  hold capacity on the account's active ship.
  """
  def buy(player_id, cargo_id, amount) do
    with :ok <- valid_request(player_id, cargo_id, amount),
         {:ok, price} <- Market.buy_price(cargo_id) do
      total = price * amount

      Repo.transaction(fn ->
        with %PlayerAccount{} = account <- lock_account(player_id),
             true <- account.credits >= total,
             {:ok, _hold} <- Inventory.add_cargo(player_id, cargo_id, amount),
             {:ok, updated} <- credit(account, -total),
             {:ok, view} <- snapshot(player_id) do
          %{exchange: view,
            receipt: receipt("bought", cargo_id, amount, price, total, updated)}
        else
          nil -> Repo.rollback(:account_not_found)
          false -> Repo.rollback(:insufficient_credits)
          {:error, reason} -> Repo.rollback(reason)
          _ -> Repo.rollback(:invalid_trade)
        end
      end)
    end
  end

  @doc "Shared input validation, before any price lookup or lock."
  def valid_request(player_id, cargo_id, amount)
      when is_integer(player_id) and player_id > 0 and is_binary(cargo_id) and
             is_integer(amount) and amount > 0 and amount <= @max_units do
    case CargoCatalog.fetch(cargo_id) do
      {:ok, _} -> :ok
      {:error, _} = error -> error
    end
  end

  def valid_request(_player_id, cargo_id, _amount) when not is_binary(cargo_id),
    do: {:error, :unknown_cargo}

  def valid_request(_player_id, _cargo_id, _amount), do: {:error, :invalid_amount}

  defp lock_account(player_id) do
    Repo.one(from a in PlayerAccount, where: a.id == ^player_id, lock: "FOR UPDATE")
  end

  defp credit(%PlayerAccount{} = account, delta) do
    account
    |> Ecto.Changeset.change(credits: account.credits + delta)
    |> Repo.update()
  end

  defp held(manifest, id) do
    case Map.get(manifest, id, 0) do
      count when is_integer(count) and count > 0 -> count
      _ -> 0
    end
  end

  defp receipt(action, cargo_id, amount, price, total, account) do
    {:ok, item} = CargoCatalog.fetch(cargo_id)

    %{action: action, cargo_id: cargo_id, name: item.name, amount: amount,
      unit_price: price, total: total, credits_remaining: account.credits}
  end
end
