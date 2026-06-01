import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(process.cwd(), '..', 'data', 'portfolio.db');

function getWriteDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

export async function GET() {
  const db = getWriteDb();
  const sources = db.prepare('SELECT * FROM monitoring_sources ORDER BY active DESC, name ASC').all();
  db.close();
  return NextResponse.json(sources);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, type, config, active, frequency, cost_type, description } = body;
  if (!name || !type || !config) {
    return NextResponse.json({ error: 'name, type, config are required' }, { status: 400 });
  }
  const db = getWriteDb();
  const result = db.prepare(`
    INSERT INTO monitoring_sources (name, type, config, active, frequency, cost_type, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, type, typeof config === 'string' ? config : JSON.stringify(config),
         active ?? 1, frequency ?? 'daily', cost_type ?? 'free', description ?? '');
  db.close();
  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, type, config, active, frequency, cost_type, description } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getWriteDb();
  db.prepare(`
    UPDATE monitoring_sources
    SET name=?, type=?, config=?, active=?, frequency=?, cost_type=?, description=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, type, typeof config === 'string' ? config : JSON.stringify(config),
         active, frequency, cost_type, description, id);
  db.close();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getWriteDb();
  db.prepare('DELETE FROM monitoring_sources WHERE id = ?').run(parseInt(id));
  db.close();
  return NextResponse.json({ ok: true });
}
