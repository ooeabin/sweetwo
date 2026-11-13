-- v2.2 PR 11: S-11f가 request_mode_change(세 질문, 08 2장)로 바뀌어 앱은 옛 set_salary_mode를 직접 부르지 않음.
-- 앱 역할(authenticated)의 실행 권한만 회수하고 함수는 남김(서버 안 apply_manage_style·테스트가 씀, 스키마는 추가만).
-- 권한 밖 경로로 엔진만 바꾸면 shared_living·manager_user_id와 어긋나고 상대 수락(D7)을 건너뛸 수 있어서.
revoke execute on function public.set_salary_mode(public.salary_mode) from authenticated;
