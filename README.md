# BLauncher

A custom Minecraft: Java Edition launcher developed for our community server.

## Overview
This launcher is designed to provide a secure and streamlined connection for our players. It handles Microsoft Authentication (OAuth) strictly following Mojang/Microsoft guidelines, verifying Java Edition ownership and fetching player profiles securely before launching the game.

## Features
- **Microsoft Authentication:** Secure login using official Microsoft Entra ID (OAuth 2.0).
- **Automated Updates:** Seamlessly downloads and manages required server mods and game files.
- **Security:** No storage or handling of access tokens on external backends; tokens are kept securely and locally on the client device.

## Tech Stack
- **Frontend:** React, TypeScript, Vite, TailwindCSS (o los estilos que uses)
- **Desktop Core:** Electron, Node.js