defmodule SunracerWeb.PasswordResetControllerTest do
  use SunracerWeb.ConnCase
  import Sunracer.AccountsFixtures
  import Swoosh.TestAssertions
  alias Sunracer.Accounts
  alias SunracerWeb.GameAuth

  test "reset email, safe GET, one-use POST and session invalidation", %{conn: conn} do
    attrs = unique_account_attributes()
    account = verified_player_account_fixture(attrs)
    old_socket_token = GameAuth.socket_token(account)
    assert html_response(get(conn, ~p"/login"), 200) =~ "Forgot your password?"
    requested = post(build_conn(), ~p"/forgot-password", %{"recovery" => %{"email" => attrs.email}})
    assert redirected_to(requested) == ~p"/forgot-password"

    assert_email_sent(fn email ->
      assert email.subject == "Reset your SunRacer password"
      [token] = Regex.run(~r/token=([a-zA-Z0-9_-]+)/, email.text_body, capture: :all_but_first)
      stored = Accounts.get_player_account!(account.id)
      refute stored.password_reset["hash"] == token
      page = get(build_conn(), ~p"/reset-password?#{%{id: account.id, token: token}}")
      assert html_response(page, 200) =~ "pilot-reset-form"
      assert html_response(page, 200) =~ "nova-auth-wordmark"
      assert get_resp_header(page, "cache-control") == ["no-store"]
      assert get_resp_header(page, "referrer-policy") == ["no-referrer"]
      assert Accounts.get_player_account!(account.id).password_hash == stored.password_hash
      params = %{"id" => Integer.to_string(account.id), "token" => token,
        "password" => "new-secret-password", "password_confirmation" => "not-matching"}
      rejected = post(build_conn(), ~p"/reset-password", %{"reset" => params})
      refute html_response(rejected, 422) =~ "new-secret-password"
      valid = Map.put(params, "password_confirmation", params["password"])
      assert redirected_to(post(build_conn(), ~p"/reset-password", %{"reset" => valid})) == ~p"/login"
      assert :error = GameAuth.verify_socket_token(old_socket_token)
      assert {:error, :invalid_credentials} = Accounts.login_account(attrs.username, attrs.password)
      assert {:ok, updated} = Accounts.login_account(attrs.username, valid["password"])
      assert updated.id == account.id
      assert updated.credits == account.credits
      assert redirected_to(post(build_conn(), ~p"/reset-password", %{"reset" => valid})) == ~p"/forgot-password"
    end)
  end

  test "unknown and unverified accounts produce same response without email", %{conn: conn} do
    unverified = player_account_fixture()
    for email <- [unverified.email, "missing@example.test"] do
      response = post(build_conn(), ~p"/forgot-password", %{"recovery" => %{"email" => email}})
      assert redirected_to(response) == ~p"/forgot-password"
      assert Phoenix.Flash.get(response.assigns.flash, :info) =~ "If an eligible account"
    end
    assert_no_email_sent()
  end

  test "reset requests are throttled and expired tokens do not change passwords" do
    account = verified_player_account_fixture()
    assert {:ok, {_, token}} = Accounts.request_password_reset(account.email)
    assert {:ok, :ignored} = Accounts.request_password_reset(account.email)
    stored = Accounts.get_player_account!(account.id)
    stored |> Ecto.Changeset.change(password_reset: Map.put(stored.password_reset,
      "expires_at", System.system_time(:second) - 1)) |> Sunracer.Repo.update!()
    assert {:error, :invalid_or_expired_token} =
      Accounts.reset_password(account.id, token, "new-password", "new-password")
    assert Accounts.get_player_account!(account.id).password_hash == stored.password_hash
  end
end
