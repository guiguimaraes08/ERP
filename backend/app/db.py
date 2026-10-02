"""Conexão e esquema do SQLite local.

O arquivo do banco fica em data/erp.db (fora do git). Cada requisição abre a
própria conexão; as escritas que mexem em várias tabelas usam `with conn:` para
virar uma transação só.
"""

import os
import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
FROZEN = getattr(sys, "frozen", False)  # rodando de dentro do .exe (PyInstaller)


def _documents_dir() -> Path:
    """Pasta Documentos de verdade, mesmo quando o Windows a moveu para o OneDrive."""
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class GUID(ctypes.Structure):
            _fields_ = [("d1", wintypes.DWORD), ("d2", wintypes.WORD),
                        ("d3", wintypes.WORD), ("d4", ctypes.c_ubyte * 8)]

        # FOLDERID_Documents = {FDD39AD0-238F-46AF-ADB4-6C85480369C7}
        folder_id = GUID(0xFDD39AD0, 0x238F, 0x46AF,
                         (ctypes.c_ubyte * 8)(0xAD, 0xB4, 0x6C, 0x85, 0x48, 0x03, 0x69, 0xC7))
        out = ctypes.c_wchar_p()
        try:
            if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(folder_id), 0, None, ctypes.byref(out)) == 0:
                path = Path(out.value)
                ctypes.windll.ole32.CoTaskMemFree(out)
                return path
        except OSError:
            pass
    return Path.home() / "Documents"


def data_dir() -> Path:
    """No .exe: Documentos/Nexos ERP (sobrevive a trocar ou mover o programa).
    Rodando do código-fonte: data/ dentro do projeto."""
    if "ERP_DATA_DIR" in os.environ:
        return Path(os.environ["ERP_DATA_DIR"])
    if not FROZEN:
        return ROOT_DIR / "data"
    folder = _documents_dir() / "Nexos ERP"
    legacy = folder.with_name("Atelie ERP")  # nome das primeiras versões
    if legacy.is_dir() and not folder.exists():
        try:
            legacy.rename(folder)
        except OSError:
            return legacy  # versão antiga ainda aberta: usa a pasta antiga desta vez
    return folder


def db_path() -> Path:
    return Path(os.environ.get("ERP_DB_PATH", data_dir() / "erp.db"))


SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insumos: filamento, fita, mosquetão, embalagem...
-- unit_cost é o custo médio por unidade (g, m, un, ml), recalculado a cada compra.
CREATE TABLE IF NOT EXISTS materials (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    unit       TEXT NOT NULL CHECK (unit IN ('g', 'm', 'un', 'ml')),
    stock      REAL NOT NULL DEFAULT 0,
    min_stock  REAL NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    unit_cost  REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    supplier   TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    archived   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Compra de insumo: "2 carretéis de 1000 g por R$ 110 cada".
CREATE TABLE IF NOT EXISTS purchases (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id   INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    packages      REAL NOT NULL CHECK (packages > 0),
    package_size  REAL NOT NULL CHECK (package_size > 0),
    package_price REAL NOT NULL CHECK (package_price >= 0),
    supplier      TEXT NOT NULL DEFAULT '',
    purchased_at  TEXT NOT NULL DEFAULT (date('now', 'localtime'))
);

-- Todo movimento de estoque fica registrado, com o motivo.
CREATE TABLE IF NOT EXISTS stock_movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    delta       REAL NOT NULL,
    reason      TEXT NOT NULL CHECK (reason IN ('compra', 'pedido', 'estorno', 'ajuste')),
    order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    note        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Produto = receita reutilizável. Tempos e quantidades são POR UNIDADE.
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    labor_minutes   REAL NOT NULL DEFAULT 0 CHECK (labor_minutes >= 0),
    machine_minutes REAL NOT NULL DEFAULT 0 CHECK (machine_minutes >= 0),
    extra_cost      REAL NOT NULL DEFAULT 0 CHECK (extra_cost >= 0),
    margin_pct      REAL CHECK (margin_pct IS NULL OR (margin_pct >= 0 AND margin_pct < 95)),
    price           REAL CHECK (price IS NULL OR price >= 0),
    archived        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS product_materials (
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    material_id INTEGER NOT NULL REFERENCES materials(id),
    quantity    REAL NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (product_id, material_id)
);

CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- stock_deducted = 1 quando o material do pedido já saiu do estoque.
CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    status         TEXT NOT NULL DEFAULT 'a_fazer'
                   CHECK (status IN ('a_fazer', 'fazendo', 'pronto', 'entregue', 'cancelado')),
    due_date       TEXT,
    notes          TEXT NOT NULL DEFAULT '',
    discount       REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
    stock_deducted INTEGER NOT NULL DEFAULT 0,
    delivered_at   TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Itens guardam uma "foto" do produto no momento do pedido: se o preço ou a
-- receita mudarem depois, o pedido antigo continua com os números dele.
CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity     REAL NOT NULL CHECK (quantity > 0),
    unit_price   REAL NOT NULL CHECK (unit_price >= 0),
    unit_cost    REAL NOT NULL DEFAULT 0,
    recipe_json  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS payments (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount   REAL NOT NULL CHECK (amount > 0),
    method   TEXT NOT NULL DEFAULT 'pix',
    paid_at  TEXT NOT NULL DEFAULT (date('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_movements_material ON stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
"""

DEFAULT_SETTINGS = {
    "business_name": "Meu Negócio",
    "labor_rate": "25",       # R$ por hora do seu trabalho
    "machine_rate": "2",      # R$ por hora de máquina (energia + desgaste)
    "default_margin": "40",   # % de margem sobre o preço de venda
    "allow_phone": "0",       # 1 = aceita acesso pelo celular na rede de casa
}


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    conn = connect()
    try:
        with conn:
            conn.executescript(SCHEMA)
            conn.executemany(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                DEFAULT_SETTINGS.items(),
            )
    finally:
        conn.close()


def is_valid_backup(path: Path) -> bool:
    """Confere se o arquivo é um banco deste sistema (e não uma foto renomeada)."""
    try:
        with open(path, "rb") as f:
            if f.read(16) != b"SQLite format 3\x00":
                return False
        conn = sqlite3.connect(path)
        try:
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
            ok = conn.execute("PRAGMA quick_check").fetchone()[0] == "ok"
        finally:
            conn.close()
        return ok and {"materials", "products", "orders", "settings"} <= tables
    except sqlite3.Error:
        return False


def copy_database(target: Path) -> None:
    """Cópia consistente do banco, mesmo com o sistema aberto (API de backup do SQLite)."""
    target.parent.mkdir(parents=True, exist_ok=True)
    src, dst = connect(), sqlite3.connect(target)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()


def auto_backup(keep: int = 30) -> None:
    """Uma cópia por dia em backups/, guardando as últimas `keep`."""
    from datetime import date

    if not db_path().exists():
        return
    folder = db_path().parent / "backups"
    target = folder / f"erp-{date.today().isoformat()}.db"
    if not target.exists():
        copy_database(target)
    for old in sorted(folder.glob("erp-????-??-??.db"))[:-keep]:
        old.unlink(missing_ok=True)


def get_db():
    """Dependência do FastAPI: uma conexão por requisição."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
