function checkAdminKey(request) {
  const queryKey = request.query?.key;
  const headerKey = request.headers['x-admin-key'];

  return (
    (queryKey || headerKey) &&
    (queryKey || headerKey) === process.env.ADMIN_ACCESS_KEY
  );
}

function getSupabaseHeaders() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (!checkAdminKey(request)) {
    return response.status(401).json({
      message: '관리자 접근 권한이 없습니다.',
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    return response.status(500).json({
      message: '서버 환경변수가 설정되지 않았습니다.',
    });
  }

  try {
    // 접수 목록 조회
    if (request.method === 'GET') {
      const supabaseResponse = await fetch(
        `${supabaseUrl}/rest/v1/service_requests?select=*&order=created_at.desc`,
        {
          headers: getSupabaseHeaders(),
        },
      );

      const result = await supabaseResponse.json();

      if (!supabaseResponse.ok) {
        console.error('Supabase 조회 오류:', result);

        return response.status(supabaseResponse.status).json({
          message: '접수 목록을 불러오지 못했습니다.',
          details: result,
        });
      }

      return response.status(200).json(result);
    }

    // 접수 상태 변경
    if (request.method === 'PATCH') {
      const id = Number(request.body?.id);
      const status = request.body?.status;

      const allowedStatuses = [
        '신규 접수',
        '고객 연락 완료',
        '방문 예정',
        '수리 진행',
        '처리 완료',
      ];

      if (!Number.isInteger(id) || id < 1) {
        return response.status(400).json({
          message: '올바른 접수번호가 아닙니다.',
        });
      }

      if (!allowedStatuses.includes(status)) {
        return response.status(400).json({
          message: '올바른 처리 상태가 아닙니다.',
        });
      }

      const supabaseResponse = await fetch(
        `${supabaseUrl}/rest/v1/service_requests?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            ...getSupabaseHeaders(),
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            status,
          }),
        },
      );

      const result = await supabaseResponse.json();

      if (!supabaseResponse.ok) {
        console.error('Supabase 상태 변경 오류:', result);

        return response.status(supabaseResponse.status).json({
          message: '처리 상태를 변경하지 못했습니다.',
          details: result,
        });
      }

      if (!Array.isArray(result) || result.length === 0) {
        return response.status(404).json({
          message: '접수 내역을 찾지 못했습니다.',
        });
      }

      return response.status(200).json(result[0]);
    }

    // 처리 완료 접수 선택 삭제
    if (request.method === 'DELETE') {
      const id = Number(request.query?.id);

      if (!Number.isInteger(id) || id < 1) {
        return response.status(400).json({
          message: '올바른 접수번호가 아닙니다.',
        });
      }

      // 삭제 전에 현재 상태 확인
      const findResponse = await fetch(
        `${supabaseUrl}/rest/v1/service_requests?id=eq.${id}&select=id,status`,
        {
          headers: getSupabaseHeaders(),
        },
      );

      const foundRequests = await findResponse.json();

      if (!findResponse.ok) {
        console.error('삭제 대상 조회 오류:', foundRequests);

        return response.status(findResponse.status).json({
          message: '삭제할 접수 내역을 확인하지 못했습니다.',
          details: foundRequests,
        });
      }

      if (
        !Array.isArray(foundRequests) ||
        foundRequests.length === 0
      ) {
        return response.status(404).json({
          message: '접수 내역을 찾지 못했습니다.',
        });
      }

      const targetRequest = foundRequests[0];

      // 처리 완료 상태만 삭제 허용
      if (targetRequest.status !== '처리 완료') {
        return response.status(400).json({
          message: '처리 완료 상태의 접수만 삭제할 수 있습니다.',
        });
      }

      const deleteResponse = await fetch(
        `${supabaseUrl}/rest/v1/service_requests?id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            ...getSupabaseHeaders(),
            Prefer: 'return=representation',
          },
        },
      );

      const deletedResult = await deleteResponse.json();

      if (!deleteResponse.ok) {
        console.error('Supabase 삭제 오류:', deletedResult);

        return response.status(deleteResponse.status).json({
          message: '접수 내역을 삭제하지 못했습니다.',
          details: deletedResult,
        });
      }

      if (
        !Array.isArray(deletedResult) ||
        deletedResult.length === 0
      ) {
        return response.status(404).json({
          message: '삭제할 접수 내역을 찾지 못했습니다.',
        });
      }

      return response.status(200).json({
        message: '접수 내역이 삭제되었습니다.',
        deleted: deletedResult[0],
      });
    }

    response.setHeader('Allow', 'GET, PATCH, DELETE');

    return response.status(405).json({
      message: '허용되지 않은 요청입니다.',
    });
  } catch (error) {
    console.error('관리자 API 오류:', error);

    return response.status(500).json({
      message: '서버 오류가 발생했습니다.',
    });
  }
}