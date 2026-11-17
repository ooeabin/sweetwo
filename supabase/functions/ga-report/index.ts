// Edge Function 진입점. 비밀 값은 Supabase 함수 비밀 값에서만(앱 코드에 넣지 않음).
import { handle, type Env } from './handler.ts';

Deno.serve((req) => handle(req, Deno.env.toObject() as unknown as Env));
