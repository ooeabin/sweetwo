import { strictEqual as assertEquals } from 'node:assert';
import { signRequest } from './sigv4.ts';

// AWS 서명 v4 시험 모음 get-vanilla(AKIDEXAMPLE, 2015-08-30T12:36:00Z, us-east-1, service)
Deno.test('get-vanilla와 같은 서명', async () => {
  const h = await signRequest({
    method: 'GET',
    url: 'https://example.amazonaws.com/',
    headers: {},
    body: '',
    region: 'us-east-1',
    service: 'service',
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    now: new Date('2015-08-30T12:36:00Z'),
  });
  assertEquals(
    h.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
  );
  assertEquals(h['x-amz-date'], '20150830T123600Z');
});
