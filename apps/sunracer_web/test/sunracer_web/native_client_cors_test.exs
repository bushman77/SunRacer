defmodule SunracerWeb.NativeClientCorsTest do
  use ExUnit.Case, async: false

  alias SunracerWeb.NativeClientCors

  test "opt-in LAN HMD HTTPS socket origin is exact-match only" do
    previous = Application.get_env(:sunracer_web, :helmet_dev_lan_https_origin)
    on_exit(fn ->
      if previous do
        Application.put_env(:sunracer_web, :helmet_dev_lan_https_origin, previous)
      else
        Application.delete_env(:sunracer_web, :helmet_dev_lan_https_origin)
      end
    end)
    Application.put_env(:sunracer_web, :helmet_dev_lan_https_origin,
      "https://192.168.7.8:4443")
    assert NativeClientCors.socket_origin_allowed?(
      URI.parse("https://192.168.7.8:4443"), [])
    refute NativeClientCors.socket_origin_allowed?(
      URI.parse("https://192.168.7.9:4443"), [])
    refute NativeClientCors.socket_origin_allowed?(
      URI.parse("http://192.168.7.8:4443"), [])
    refute NativeClientCors.socket_origin_allowed?(
      URI.parse("https://192.168.7.8:4444"), [])
    refute NativeClientCors.socket_origin_allowed?(
      URI.parse("https://malicious.example:4443"), [])
  end
end
