import { invoke } from "@tauri-apps/api/core";
import type { GameScanResult, LaunchGameRequest } from "./types";

export const listInstalledGames = () =>
  invoke<GameScanResult>("list_installed_games");

export const launchGame = (request: LaunchGameRequest) =>
  invoke<void>("launch_game", { request });
