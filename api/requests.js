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

/*
 * DB에 저장된 사진 값을 URL 배열로 변환한다.
 */
function parseImageUrls(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  const text = String(value).trim();

  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean);
    }

    if (typeof parsed === 'string') {
      return [parsed];
    }
  } catch (error) {
    // 과거에 URL 한 개만 저장된 데이터도 처리한다.
  }

  if (text.startsWith('http://') || text.startsWith('https://')) {
    return [text];
  }

  return [];
}

/*
 * 공개 사진 주소에서 service-images 버킷 내부 경로만 추출한다.
 *
 * 예:
 * https://프로젝트.supabase.co/storage/v1/object/public/service-images/폴더/nameplate/a.jpg
 *
 * 결과:
 * 폴더/nameplate/a.jpg
 */
function getStoragePathFromUrl(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  try {
    const decodedUrl = decodeURIComponent(String(imageUrl));

    const publicMarker = '/storage/v1/object/public/service-images/';

    const signedMarker = '/storage/v1/object/sign/service-images/';

    if (decodedUrl.includes(publicMarker)) {
      return decodedUrl.split(publicMarker)[1].split('?')[0];
    }

    if (decodedUrl.includes(signedMarker)) {
      return decodedUrl.split(signedMarker)[1].split('?')[0];
    }

    return null;
  } catch (error) {
    console.error('사진 경로 변환 오류:', error);

    return null;
  }
}

/*
 * Supabase Storage에서 사진 여러 장을 삭제한다.
 */
async function deleteStorageFiles(supabaseUrl, imagePaths) {
  const uniquePaths = [...new Set(imagePaths.filter(Boolean))];

  if (uniquePaths.length === 0) {
    return [];
  }

  const storageResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/service-images`,
    {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        prefixes: uniquePaths,
      }),
    },
  );

  let result = null;

  try {
    result = await storageResponse.json();
  } catch (error) {
    result = null;
  }

  if (!storageResponse.ok) {
    console.error('Supabase 사진 삭제 오류:', result);

    const message =
      result?.message || result?.error || '사진 파일을 삭제하지 못했습니다.';

    throw new Error(message);
  }

  return result;
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
    /*
     * 접수 목록 조회
     */
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

    /*
     * 접수 상태 또는 관리자 방문 일정 변경
     */
    if (request.method === 'PATCH') {
      const id = Number(request.body?.id);

      const status = request.body?.status;

      const adminVisitAt = request.body?.admin_visit_at;

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

      const updateData = {};

      if (status !== undefined) {
        if (!allowedStatuses.includes(status)) {
          return response.status(400).json({
            message: '올바른 처리 상태가 아닙니다.',
          });
        }

        updateData.status = status;
      }

      if (adminVisitAt !== undefined) {
        const parsedDate = new Date(adminVisitAt);

        if (!adminVisitAt || Number.isNaN(parsedDate.getTime())) {
          return response.status(400).json({
            message: '올바른 방문 예정 날짜와 시간을 입력해 주세요.',
          });
        }

        updateData.admin_visit_at = parsedDate.toISOString();
      }

      if (Object.keys(updateData).length === 0) {
        return response.status(400).json({
          message: '변경할 내용이 없습니다.',
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

          body: JSON.stringify(updateData),
        },
      );

      const result = await supabaseResponse.json();

      if (!supabaseResponse.ok) {
        console.error('Supabase 정보 변경 오류:', result);

        return response.status(supabaseResponse.status).json({
          message: '접수 정보를 변경하지 못했습니다.',

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

    /*
     * 처리 완료 접수와 사진 모두 삭제
     */
    if (request.method === 'DELETE') {
      const id = Number(request.query?.id);

      if (!Number.isInteger(id) || id < 1) {
        return response.status(400).json({
          message: '올바른 접수번호가 아닙니다.',
        });
      }

      /*
       * 먼저 접수 상태와 사진 주소를 가져온다.
       */
      const findResponse = await fetch(
        `${supabaseUrl}/rest/v1/service_requests?id=eq.${id}&select=id,status,nameplate_image,problem_image`,
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

      if (!Array.isArray(foundRequests) || foundRequests.length === 0) {
        return response.status(404).json({
          message: '접수 내역을 찾지 못했습니다.',
        });
      }

      const targetRequest = foundRequests[0];

      if (targetRequest.status !== '처리 완료') {
        return response.status(400).json({
          message: '처리 완료 상태의 접수만 삭제할 수 있습니다.',
        });
      }

      /*
       * 명판 사진과 이상 부위 사진 URL을 합친다.
       */
      const imageUrls = [
        ...parseImageUrls(targetRequest.nameplate_image),

        ...parseImageUrls(targetRequest.problem_image),
      ];

      /*
       * URL을 Storage 내부 파일 경로로 변환한다.
       */
      const imagePaths = imageUrls.map(getStoragePathFromUrl).filter(Boolean);

      /*
       * 사진이 있다면 Storage에서 먼저 삭제한다.
       * 사진 삭제에 실패하면 DB 정보는 삭제하지 않는다.
       */
      if (imagePaths.length > 0) {
        await deleteStorageFiles(supabaseUrl, imagePaths);
      }

      /*
       * 사진 삭제가 성공한 뒤 접수 DB 행을 삭제한다.
       */
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
        console.error('접수 DB 삭제 오류:', deletedResult);

        return response.status(deleteResponse.status).json({
          message: '사진은 삭제됐지만 접수 정보를 삭제하지 못했습니다.',

          details: deletedResult,
        });
      }

      return response.status(200).json({
        message: '접수 정보와 사진이 모두 삭제되었습니다.',

        deleted: deletedResult[0] || null,

        deletedImageCount: imagePaths.length,
      });
    }

    response.setHeader('Allow', 'GET, PATCH, DELETE');

    return response.status(405).json({
      message: '허용되지 않은 요청입니다.',
    });
  } catch (error) {
    console.error('관리자 API 오류:', error);

    return response.status(500).json({
      message: error.message || '서버 오류가 발생했습니다.',
    });
  }
}
