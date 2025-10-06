import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = NextResponse.json({
      success: false,
      message: 'Descoberta automática indisponível no servidor. Execute o script discover_cameras.py manualmente.',
      request: body,
    }, { status: 503 });

    response.headers.set('Cache-Control', 'no-store, max-age=0');

    return response;
  } catch (error) {
    const response = NextResponse.json({
      success: false,
      error: 'Não foi possível processar a solicitação de descoberta',
      details: String(error),
    }, { status: 500 });

    response.headers.set('Cache-Control', 'no-store, max-age=0');

    return response;
  }
}
