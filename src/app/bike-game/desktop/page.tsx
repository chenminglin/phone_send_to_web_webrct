'use client';

import { useEffect, useState, useRef } from 'react';
import { nanoid } from 'nanoid';
import QRCode from 'react-qr-code';


// 自行车游戏类
class BikeGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bikeX: number;
  bikeY: number;
  bikeWidth: number;
  bikeHeight: number;
  bikeSpeed: number;
  bikeRotation: number;
  pedalAngle: number;
  pedalSpeed: number;
  isGameStarted: boolean;
  distance: number;
  lastTimestamp: number;
  backgroundX: number;
  finishLineX: number;
  raceLength: number;
  opponents: Array<{x: number, y: number, speed: number, pedalAngle: number}>;
  playerRank: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    
    // 设置画布大小为窗口大小
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    // 自行车位置和大小
    this.bikeWidth = 120;
    this.bikeHeight = 80;
    this.bikeX = 100;
    this.bikeY = this.canvas.height / 2;
    this.bikeSpeed = 0;
    this.bikeRotation = 0;
    
    // 踏板角度和速度
    this.pedalAngle = 0;
    this.pedalSpeed = 0;
    
    // 游戏状态
    this.isGameStarted = false;
    this.distance = 0;
    this.lastTimestamp = 0;
    this.backgroundX = 0;
    
    // 比赛长度和终点线
    this.raceLength = 5000; // 比赛总长度
    this.finishLineX = this.raceLength;
    
    // 对手
    this.opponents = [
      { x: 100, y: this.canvas.height / 2 - 100, speed: 2 + Math.random(), pedalAngle: 0 },
      { x: 100, y: this.canvas.height / 2 + 100, speed: 2 + Math.random(), pedalAngle: 0 },
    ];
    
    // 玩家排名
    this.playerRank = 1;
    
    // 绑定窗口大小变化事件
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  
  // 处理窗口大小变化
  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.bikeY = this.canvas.height / 2;
  }
  
  // 开始游戏
  start() {
    this.isGameStarted = true;
    this.distance = 0;
    this.bikeSpeed = 0;
    this.pedalSpeed = 0;
    this.lastTimestamp = performance.now();
    this.backgroundX = 0;
    this.opponents.forEach(opponent => {
      opponent.x = 100;
      opponent.speed = 2 + Math.random();
    });
    requestAnimationFrame(this.gameLoop.bind(this));
  }
  
  // 重置游戏
  reset() {
    this.isGameStarted = false;
    this.distance = 0;
    this.bikeSpeed = 0;
    this.pedalSpeed = 0;
    this.backgroundX = 0;
    this.opponents.forEach(opponent => {
      opponent.x = 100;
    });
    this.draw();
  }
  
  // 更新游戏状态
  update(gyroData: {rotationRate: number}) {
    console.log("更新数据 this.isGameStarted ",this.isGameStarted)
    if (!this.isGameStarted) return;
    console.log("gyroData.rotationRate ",gyroData.rotationRate)
    // 根据陀螺仪数据更新踏板速度
    // 陀螺仪数据中的rotationRate表示手机旋转速度
    this.pedalSpeed = Math.abs(gyroData.rotationRate) * 0.1;
    
    
    // 限制最大速度
    this.pedalSpeed = Math.min(this.pedalSpeed, 10);
    console.log("pedalSpeed ",this.pedalSpeed)

    // 更新自行车速度（逐渐加速或减速）
    this.bikeSpeed = this.bikeSpeed * 0.95 + this.pedalSpeed * 0.05;

    console.log("bikeSpeed ",this.bikeSpeed)
    
    // 更新踏板角度
    this.pedalAngle += this.pedalSpeed * 5;
    if (this.pedalAngle > 360) this.pedalAngle -= 360;
    
    // 更新距离
    const now = performance.now();
    const deltaTime = (now - this.lastTimestamp) / 1000; // 转换为秒
    this.lastTimestamp = now;
    
    this.distance += this.bikeSpeed * deltaTime * 50;
    this.backgroundX -= this.bikeSpeed * deltaTime * 50;
    
    // 更新对手位置
    this.opponents.forEach(opponent => {
      opponent.x += opponent.speed * deltaTime * 50;
      opponent.pedalAngle += opponent.speed * 5;
      if (opponent.pedalAngle > 360) opponent.pedalAngle -= 360;
    });
    
    // 计算排名
    this.calculateRank();
    
    // 检查是否到达终点
    if (this.distance >= this.raceLength) {
      this.isGameStarted = false;
    }
  }
  
  // 计算排名
  calculateRank() {
    let rank = 1;
    for (const opponent of this.opponents) {
      if (opponent.x > this.distance) {
        rank++;
      }
    }
    this.playerRank = rank;
  }
  
  // 游戏循环
  gameLoop(timestamp: number) {
    if (!this.isGameStarted) return;
    
    this.draw();
    requestAnimationFrame(this.gameLoop.bind(this));
  }
  
  // 绘制游戏
  draw() {
    const ctx = this.ctx;
    
    // 清空画布
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制背景
    this.drawBackground();
    
    // 绘制终点线
    this.drawFinishLine();
    
    // 绘制对手
    this.opponents.forEach(opponent => {
      this.drawBike(opponent.x - this.distance + 100, opponent.y, opponent.pedalAngle, '#FF5555');
    });
    
    // 绘制玩家自行车
    this.drawBike(this.bikeX, this.bikeY, this.pedalAngle, '#55AAFF');
    
    // 绘制UI
    this.drawUI();
  }
  
  // 绘制背景
  drawBackground() {
    const ctx = this.ctx;
    
    // 绘制天空
    const skyGradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#E0F7FF');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制地面
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, this.canvas.height * 0.7, this.canvas.width, this.canvas.height * 0.3);
    
    // 绘制赛道
    ctx.fillStyle = '#A9A9A9';
    ctx.fillRect(0, this.canvas.height * 0.7 - 20, this.canvas.width, 40);
    
    // 绘制赛道标记
    ctx.strokeStyle = '#FFFFFF';
    ctx.setLineDash([30, 30]);
    ctx.beginPath();
    ctx.moveTo(0, this.canvas.height * 0.7);
    ctx.lineTo(this.canvas.width, this.canvas.height * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制远处的山脉
    this.drawMountains();
  }
  
  // 绘制山脉
  drawMountains() {
    const ctx = this.ctx;
    ctx.fillStyle = '#228B22';
    
    // 第一座山
    ctx.beginPath();
    ctx.moveTo(0, this.canvas.height * 0.7);
    ctx.lineTo(this.canvas.width * 0.3, this.canvas.height * 0.4);
    ctx.lineTo(this.canvas.width * 0.5, this.canvas.height * 0.7);
    ctx.fill();
    
    // 第二座山
    ctx.beginPath();
    ctx.moveTo(this.canvas.width * 0.4, this.canvas.height * 0.7);
    ctx.lineTo(this.canvas.width * 0.7, this.canvas.height * 0.5);
    ctx.lineTo(this.canvas.width, this.canvas.height * 0.7);
    ctx.fill();
  }
  
  // 绘制终点线
  drawFinishLine() {
    const ctx = this.ctx;
    
    // 计算终点线在屏幕上的位置
    const finishLineScreenX = this.finishLineX - this.distance + 100;
    
    // 如果终点线在可视范围内
    if (finishLineScreenX >= 0 && finishLineScreenX <= this.canvas.width) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(finishLineScreenX - 5, this.canvas.height * 0.7 - 50, 10, 50);
      
      // 绘制格子旗
      const flagSize = 10;
      const flagHeight = 100;
      ctx.fillStyle = '#000000';
      
      for (let y = 0; y < flagHeight; y += flagSize) {
        for (let x = 0; x < flagSize * 4; x += flagSize) {
          if ((x + y) % (flagSize * 2) === 0) {
            ctx.fillRect(finishLineScreenX + x, this.canvas.height * 0.7 - 150 + y, flagSize, flagSize);
          }
        }
      }
    }
  }
  
  // 绘制自行车
  drawBike(x: number, y: number, pedalAngle: number, color: string) {
    const ctx = this.ctx;
    const bikeY = this.canvas.height * 0.7 - 30; // 自行车在赛道上的位置
    
    // 保存当前状态
    ctx.save();
    
    // 移动到自行车位置
    ctx.translate(x, bikeY);
    
    // 绘制车轮
    const wheelRadius = 20;
    const wheelDistance = 60;
    
    // 后轮
    ctx.beginPath();
    ctx.arc(-wheelDistance/2, 0, wheelRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 后轮辐条
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(-wheelDistance/2, 0);
      ctx.lineTo(-wheelDistance/2 + Math.cos(angle) * wheelRadius, Math.sin(angle) * wheelRadius);
      ctx.stroke();
    }
    
    // 前轮
    ctx.beginPath();
    ctx.arc(wheelDistance/2, 0, wheelRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // 前轮辐条
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wheelDistance/2, 0);
      ctx.lineTo(wheelDistance/2 + Math.cos(angle) * wheelRadius, Math.sin(angle) * wheelRadius);
      ctx.stroke();
    }
    
    // 车架
    ctx.beginPath();
    ctx.moveTo(-wheelDistance/2, 0); // 后轮中心
    ctx.lineTo(0, -30); // 座位
    ctx.lineTo(wheelDistance/2, -15); // 车把
    ctx.lineTo(wheelDistance/2, 0); // 前轮中心
    ctx.lineTo(0, 0); // 脚踏板中心
    ctx.lineTo(-wheelDistance/2, 0); // 回到后轮中心
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 座位
    ctx.beginPath();
    ctx.ellipse(0, -30, 10, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // 车把
    ctx.beginPath();
    ctx.moveTo(wheelDistance/2, -15);
    ctx.lineTo(wheelDistance/2 + 10, -20);
    ctx.stroke();
    
    // 脚踏板
    const pedalRadius = 15;
    const pedalAngleRad = (pedalAngle * Math.PI) / 180;
    
    // 脚踏板轴
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // 脚踏板踏板
    ctx.beginPath();
    ctx.arc(Math.cos(pedalAngleRad) * pedalRadius, Math.sin(pedalAngleRad) * pedalRadius, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // 脚踏板连杆
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(pedalAngleRad) * pedalRadius, Math.sin(pedalAngleRad) * pedalRadius);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 骑手
    this.drawRider(ctx, -10, -40, color);
    
    // 恢复状态
    ctx.restore();
  }
  
  // 绘制骑手
  drawRider(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    // 头部
    ctx.beginPath();
    ctx.arc(x, y - 10, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 身体
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 20);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 手臂
    ctx.beginPath();
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x + 15, y + 10);
    ctx.stroke();
    
    // 腿
    ctx.beginPath();
    ctx.moveTo(x, y + 20);
    ctx.lineTo(x + 5, y + 35);
    ctx.stroke();
  }
  
  // 绘制UI
  drawUI() {
    const ctx = this.ctx;
    
    // 绘制速度表
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(20, 20, 150, 80);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.fillText(`速度: ${this.bikeSpeed.toFixed(1)} km/h`, 30, 45);
    ctx.fillText(`距离: ${(this.distance / 100).toFixed(1)} m`, 30, 70);
    ctx.fillText(`排名: ${this.playerRank}/${this.opponents.length + 1}`, 30, 95);
    
    // 如果比赛结束，显示结果
    if (this.distance >= this.raceLength) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(this.canvas.width / 2 - 150, this.canvas.height / 2 - 100, 300, 200);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('比赛结束!', this.canvas.width / 2, this.canvas.height / 2 - 50);
      ctx.fillText(`最终排名: ${this.playerRank}`, this.canvas.width / 2, this.canvas.height / 2);
      ctx.font = '16px Arial';
      ctx.fillText('点击屏幕重新开始', this.canvas.width / 2, this.canvas.height / 2 + 50);
      ctx.textAlign = 'left';
    }
  }
}

export default function BikeGameDesktop() {
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [localIp, setLocalIp] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [playerRank, setPlayerRank] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BikeGame | null>(null);
  const peerRef = useRef<any>(null);
  
  // 初始化游戏和WebRTC连接
  useEffect(() => {
    // 初始化游戏
    if (canvasRef.current) {
      const game = new BikeGame(canvasRef.current);
      gameRef.current = game;
      game.draw(); // 初始绘制
      
      // 监听点击事件，用于重新开始游戏
      canvasRef.current.addEventListener('click', () => {
        if (gameRef.current && !gameRef.current.isGameStarted) {
          gameRef.current.start();
          setGameStarted(true);
          setGameFinished(false);
        }
      });
    }
    
    // 初始化WebRTC连接
    const initPeer = async () => {
      try {
        // 获取本地IP地址
        const response = await fetch('/api/get-local-ip');
        const data = await response.json();
        setLocalIp(data.ip);

        const { default: Peer } = await import('simple-peer');
        const id = nanoid(10);
        setPeerId(id);

        // 创建接收端Peer
        const peer = new Peer({
          initiator: false,
          trickle: false
        });

        peer.on('signal', async (data: any) => {
          // 当接收到offer后，生成answer信令数据
          console.log('生成应答信令数据:', data);

          // 将应答信令数据发送回手机端
          try {
            const response = await fetch(`/api/answer?id=${id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw new Error(`应答信令发送失败: ${response.status}`);
            }

            console.log('应答信令数据已发送到服务器');
          } catch (error) {
            console.error('发送应答信令数据失败:', error);
          }
        });

        peer.on('connect', () => {
          console.log('连接已建立!');
          setConnected(true);
        });

        peer.on('data', (data: any) => {
          try {
            // 解析接收到的陀螺仪数据
            const gyroData = JSON.parse(new TextDecoder().decode(data));
            console.log('接收到陀螺仪数据:', gyroData);
            console.log('gameRef.current:', gameRef.current);
            
            // 更新游戏状态
            if (gameRef.current) {
              gameRef.current.update(gyroData);
              
              // 检查游戏是否结束
              if (gameRef.current.distance >= gameRef.current.raceLength && !gameFinished) {
                setGameFinished(true);
                setGameStarted(false);
                setPlayerRank(gameRef.current.playerRank);
              }
            }
          } catch (error) {
            console.error('处理接收数据失败:', error);
          }
        });

        peer.on('error', (err: any) => {
          console.error('WebRTC连接错误:', err);
        });

        peerRef.current = peer;

        // 记录已处理的信令数据版本
        let processedVersion = 0;

        // 定期检查是否有新的信令数据
        const checkSignalInterval = setInterval(async () => {
          if (connected) {
            console.log('已连接成功，停止检查信令数据');
            clearInterval(checkSignalInterval);
            return;
          }

          try {
            console.log(`正在检查ID为${id}的信令数据...`);
            const signalResponse = await fetch(`/api/signal?id=${id}&version=${processedVersion}`);

            if (signalResponse.status === 404) {
              console.log(`ID为${id}的信令数据尚未准备好，等待中...`);
              return; // 继续等待下一次轮询
            }

            if (!signalResponse.ok) {
              console.error(`获取信令数据失败，状态码: ${signalResponse.status}`);
              return;
            }

            const signalData = await signalResponse.json();

            // 检查是否有更新
            if (signalData.noUpdate) {
              console.log('没有新的信令数据，继续等待...');
              return;
            }

            if (signalData.signal) {
              console.log('从API获取到信令数据:', signalData.signal);
              try {
                // 更新已处理的版本
                if (signalData.version) {
                  processedVersion = signalData.version;
                }

                // 只有在连接未建立时才应用信令数据
                if (!connected) {
                  peer.signal(signalData.signal);
                  console.log('已将信令数据应用到Peer连接');
                } else {
                  console.log('连接已建立，忽略新的信令数据');
                }
              } catch (signalError) {
                console.error('应用信令数据失败:', signalError);
              }
            } else {
              console.warn('API返回了成功状态，但没有信令数据');
            }
          } catch (error) {
            console.error('获取信令数据失败:', error);
          }
        }, 2000); // 每2秒检查一次

        return () => clearInterval(checkSignalInterval);
      } catch (error) {
        console.error('初始化Peer失败:', error);
      }
    };

    initPeer();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  const [copyStatus, setCopyStatus] = useState('');
  const [copyUrlStatus, setCopyUrlStatus] = useState('');

  const handleCopyUrl = async () => {
    const url = process.env.NEXT_PUBLIC_USE_LOCAL_IP === 'true' 
      ? `https://${localIp}:3000/bike-game/mobile?id=${peerId}` 
      : `https://${process.env.NEXT_PUBLIC_DOMAIN}/bike-game/mobile?id=${peerId}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!success) {
          throw new Error('复制命令执行失败');
        }
      }
      
      setCopyUrlStatus('已复制');
      setTimeout(() => setCopyUrlStatus(''), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      setCopyUrlStatus('复制失败');
    }
  };

  const handleCopyId = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(peerId);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = peerId;
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!success) {
          throw new Error('复制命令执行失败');
        }
      }
      
      setCopyStatus('已复制');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      setCopyStatus('复制失败');
    }
  };

  const startGame = () => {
    if (gameRef.current && !gameRef.current.isGameStarted) {
      gameRef.current.start();
      setGameStarted(true);
      setGameFinished(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <h1 className="text-3xl font-bold mb-4 text-white">自行车比赛</h1>
      
      {!connected ? (
        <div className="flex flex-col items-center bg-white p-8 rounded-lg shadow-md mb-4">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">连接手机控制器</h2>
          <ol className="list-decimal list-inside mb-6 text-left text-gray-900">
            <li className="mb-2">在手机上访问: <span className="font-mono bg-gray-100 p-1 rounded text-gray-900">{process.env.NEXT_PUBLIC_USE_LOCAL_IP === 'true' ? `https://${localIp}:3000/bike-game/mobile` : `https://${process.env.NEXT_PUBLIC_DOMAIN}/bike-game/mobile`}</span></li>
            <li className="mb-2">输入下方的连接ID</li>
            <li>点击"连接"按钮</li>
          </ol>

          <div className="bg-gray-100 p-4 rounded-md mb-6 w-full">
            <div className="flex items-center justify-center space-x-2">
              <p className="font-mono text-lg break-all text-gray-900">{peerId}</p>
              <button
                onClick={handleCopyId}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                {copyStatus || '复制'}
              </button>
            </div>
            <li className="mb-2">在手机上访问: 
              <span className="font-mono bg-gray-100 p-1 rounded text-gray-900">
                {process.env.NEXT_PUBLIC_USE_LOCAL_IP === 'true' ? `https://${localIp}:3000/bike-game/mobile?id=${peerId}` : `https://${process.env.NEXT_PUBLIC_DOMAIN}/bike-game/mobile?id=${peerId}`}
              </span>
              <button
                onClick={handleCopyUrl}
                className="ml-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                {copyUrlStatus || '复制'}
              </button>
            </li>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-900 mb-2">或者扫描二维码访问手机端</p>
            {localIp && (
              <div className="bg-white p-4 inline-block">
                <QRCode value={process.env.NEXT_PUBLIC_USE_LOCAL_IP === 'true' ? `https://${localIp}:3000/bike-game/mobile?id=${peerId}` : `https://${process.env.NEXT_PUBLIC_DOMAIN}/bike-game/mobile?id=${peerId}`} size={200} />
              </div>
            )}
          </div>
        </div>
      ) : !gameStarted ? (
        <div className="bg-white p-6 rounded-lg shadow-md mb-4 text-center">
          <div className="bg-green-100 text-green-800 p-4 rounded-md mb-4">
            <p className="font-semibold">✓ 已连接到手机</p>
          </div>
          <p className="text-gray-900 mb-4">准备好开始比赛了吗？</p>
          <p className="text-gray-700 mb-6">横握手机，双手握住手机两端，摇动手机来驱动自行车前进！</p>
          <button 
            onClick={startGame}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            开始比赛
          </button>
        </div>
      ) : null}
      
      <div className="relative w-full h-[70vh]">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full"
        />
      </div>
    </div>
  );
}