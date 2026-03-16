import { NextResponse } from "next/server";

export async function POST() {
  try {
    // 1. 从环境变量中读取密钥 (服务器端安全读取)
    const userName = process.env.NEXT_PUBLIC_TOPSTEPX_USERNAME;
    const apiKey = process.env.NEXT_PUBLIC_TOPSTEPX_API_KEY;

    // 2. 检查环境变量是否配置正确
    if (!userName || !apiKey) {
      console.error("环境变量缺失: 请检查 .env.local 文件");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 },
      );
    }

    // 3. 目标 TopstepX 登录接口
    const targetUrl = "https://api.topstepx.com/api/Auth/loginKey";

    // 4. 向 TopstepX 发送认证请求
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userName, apiKey }),
    });

    const data = await response.json();

    // 5. 错误处理
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Authentication failed", details: data },
        { status: response.status },
      );
    }

    // 6. 成功获取 Token，返回给前端
    return NextResponse.json({ success: true, data: data }, { status: 200 });
  } catch (error) {
    console.error("Login Auth Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
