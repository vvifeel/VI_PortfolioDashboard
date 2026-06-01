import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (msg: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ msg })}\n\n`));
      };

      send('📋 우선순위 계획 생성 중...');

      const scriptPath = path.join(process.cwd(), '..', 'scripts', 'db_writer.py');
      const proc = spawn('python3', [scriptPath, 'generate-plan'], {
        cwd: path.join(process.cwd(), '..'),
      });

      proc.stdout.on('data', (data: Buffer) => {
        data.toString().split('\n').filter(Boolean).forEach((line: string) => send(line));
      });

      proc.stderr.on('data', (data: Buffer) => {
        data.toString().split('\n').filter(Boolean).forEach((line: string) => send(`⚠ ${line}`));
      });

      proc.on('close', (code: number | null) => {
        if (code === 0) {
          send('✅ 계획 생성 완료. Agent를 실행하면 수집이 시작됩니다.');
        } else {
          send(`❌ 오류 (exit ${code})`);
        }
        send('__DONE__');
        controller.close();
      });

      proc.on('error', (err: Error) => {
        send(`❌ 실행 오류: ${err.message}`);
        send('__DONE__');
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
