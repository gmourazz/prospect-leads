// Package db exposes the SQL migrations as an embedded filesystem so the API
// binary is self-contained: no external migration tool to install or forget.
package db

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS
