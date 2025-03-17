'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function MobileGameContent() {
  const searchParams = useSearchParams();
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('未连接');
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [rotationRate, setRotationRate] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationOffset, setCalibrationOffset] = useState(0);
  
  const peerRef = useRef<any>(null);
  const gyroIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  // 添加一个 ref 来存储最新的 rotationRate
  const rotationRateRef = useRef(0);

  // 检查设备是否支持陀螺仪
  useEffect(() => {
    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      setGyroAvailable(true);
    } else {
      setGyroAvailable(false);
    }
    
    // 从URL参数中获取ID
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setPeerId(idFromUrl);
      setAutoFilled(true);
    }
    
    // 强制横屏
    // const lockOrientation = () => {
    //   try {
    //     if (screen.orientation && screen.orientation.lock) {
    //       screen.orientation.lock('landscape').catch(e => {
    //         console.error('无法锁定屏幕方向:', e);
    //       });
    //     }
    //   } catch (error) {
    //     console.error('锁定屏幕方向失败:', error);
    //   }
    // };
    // lockOrientation();
    
    return () => {
      // 清理陀螺仪监听
      if (gyroIntervalRef.current) {
        clearInterval(gyroIntervalRef.current);
      }
      
      // 恢复屏幕方向
    //   try {
    //     if (screen.orientation && screen.orientation.unlock) {
    //       screen.orientation.unlock();
    //     }
    //   } catch (error) {
    //     console.error('解锁屏幕方向失败:', error);
    //   }
    };
  }, [searchParams]);

  // 连接到电脑端
  const handleConnect = async () => {
    if (!peerId.trim()) {
      alert('请输入连接ID');
      return;
    }

    try {
      setConnectionStatus('正在连接...');
      
      // 动态导入simple-peer以避免SSR问题
      const { default: Peer } = await import('simple-peer');
      
      // 创建发起方Peer
      const peer = new Peer({
        initiator: true,
        trickle: false
      });

      peer.on('signal', async (data: any) => {
        console.log('生成信令数据:', data);
        // 将信令数据发送到电脑端
        try {
          const response = await fetch(`/api/signal?id=${peerId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });
          
          if (!response.ok) {
            throw new Error(`信令发送失败: ${response.status}`);
          }
          
          console.log('信令数据已发送到电脑端');
        } catch (error) {
          console.error('发送信令数据失败:', error);
          setConnectionStatus('连接失败: 无法发送信令数据');
        }
      });

      peer.on('connect', () => {
        console.log('连接已建立!');
        setConnected(true);
        setConnectionStatus('已连接');
        
        // 开始监听陀螺仪数据并发送
        startGyroMonitoring(peer);
      });

      peer.on('error', (err: any) => {
        console.error('连接错误:', err);
        setConnectionStatus('连接失败');
      });

      peerRef.current = peer;
      
      // 记录已处理的应答信令数据版本
      let processedVersion = 0;
      
      // 定期检查是否有新的应答信令数据
      const checkAnswerInterval = setInterval(async () => {
        if (connected) {
          console.log('已连接成功，停止检查应答信令数据');
          clearInterval(checkAnswerInterval);
          return;
        }
        
        try {
          console.log(`正在检查ID为${peerId}的应答信令数据...`);
          const answerResponse = await fetch(`/api/answer?id=${peerId}&version=${processedVersion}`);
          
          if (answerResponse.status === 404) {
            console.log(`ID为${peerId}的应答信令数据尚未准备好，等待中...`);
            return; // 继续等待下一次轮询
          }
          
          if (!answerResponse.ok) {
            console.error(`获取应答信令数据失败，状态码: ${answerResponse.status}`);
            return;
          }
          
          const answerData = await answerResponse.json();
          
          // 检查是否有更新
          if (answerData.noUpdate) {
            console.log('没有新的应答信令数据，继续等待...');
            return;
          }
          
          if (answerData.signal) {
            console.log('从API获取到应答信令数据:', answerData.signal);
            try {
              // 更新已处理的版本
              if (answerData.version) {
                processedVersion = answerData.version;
              }
              
              // 只有在连接未建立时才应用信令数据
              if (!connected) {
                peer.signal(answerData.signal);
                console.log('已将应答信令数据应用到Peer连接');
              } else {
                console.log('连接已建立，忽略新的应答信令数据');
              }
            } catch (signalError) {
              console.error('应用应答信令数据失败:', signalError);
            }
          } else {
            console.warn('API返回了成功状态，但没有应答信令数据');
          }
        } catch (error) {
          console.error('获取应答信令数据失败:', error);
        }
      }, 2000); // 每2秒检查一次
      
      return () => clearInterval(checkAnswerInterval);
    } catch (error) {
      console.error('初始化Peer失败:', error);
      setConnectionStatus('连接失败');
    }
  };

  // 开始监听陀螺仪数据
  const startGyroMonitoring = (peer: any) => {
    if (!gyroAvailable) return;
    
    // 请求陀螺仪权限
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            setupGyroListener(peer);
          } else {
            console.error('陀螺仪权限被拒绝');
            alert('需要陀螺仪权限才能控制游戏');
          }
        })
        .catch(error => {
          console.error('请求陀螺仪权限失败:', error);
          // 尝试直接设置监听
          setupGyroListener(peer);
        });
    } else {
      // 对于不需要请求权限的设备，直接设置监听
      setupGyroListener(peer);
    }
  };

  // 设置陀螺仪监听
  const setupGyroListener = (peer: any) => {
    // 使用定时器定期发送陀螺仪数据
    gyroIntervalRef.current = setInterval(() => {
      if (peer && peer.connected) {
        // 使用 ref 中的值而不是 state
        console.log('rotationRate:', rotationRateRef.current, 'calibrationOffset:', calibrationOffset);
        const gyroData = {
          rotationRate: rotationRateRef.current - calibrationOffset
        };
        peer.send(JSON.stringify(gyroData));
      }
    }, 50);
    // 改用 devicemotion 事件来检测摇动
    window.addEventListener('devicemotion', handleMotion);
  };

  // 处理设备运动数据
  const handleMotion = (event: DeviceMotionEvent) => {
    if (event.rotationRate && event.rotationRate.beta !== null) {
      const speed = Math.abs(event.rotationRate.beta) * 10;
      console.log('陀螺仪数据normalizedSpeed:', speed);
      const normalizedSpeed = Math.min(speed / 20, 50);
      console.log('陀螺仪数据normalizedSpeed:', normalizedSpeed);
      rotationRateRef.current = normalizedSpeed; // 更新 ref
      setRotationRate(normalizedSpeed);
    }
  };

  // 清理函数也需要更新
  useEffect(() => {
    // ... existing code ...
    
    return () => {
      if (gyroIntervalRef.current) {
        clearInterval(gyroIntervalRef.current);
      }
      // 移除事件监听器
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [searchParams]);
  
  // 监听设备方向变化
  const handleOrientation = (event: DeviceOrientationEvent) => {
    // 使用gamma（左右倾斜）作为旋转速度
    // gamma范围为-90到90度，左倾为负，右倾为正
    if (event.gamma !== null) {
      // 计算旋转速度，根据倾斜角度的变化率
      console.log('陀螺仪数据event.gamma:', event.gamma);
      const newRotationRate = Math.abs(event.gamma) / 5;
      console.log('陀螺仪数据newRotationRate:', newRotationRate);
      setRotationRate(newRotationRate);
    }
  };

  // 校准陀螺仪
  const calibrateGyro = () => {
    setIsCalibrating(true);
    // 记录当前值作为偏移量
    setTimeout(() => {
      console.log('陀螺仪校准完成，rotationRate:', rotationRate);
      setCalibrationOffset(rotationRate);
      setIsCalibrating(false);
    }, 1000); // 给用户1秒时间保持手机静止
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
      <h1 className="text-2xl font-bold mb-6 text-center text-white">自行车比赛 - 手机控制器</h1>
      
      {!connected ? (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">连接到电脑</h2>
          
          <div className="mb-4">
            <label htmlFor="peerId" className="block text-sm font-medium text-gray-800 mb-1">连接ID</label>
            <input
              type="text"
              id="peerId"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              className={`w-full px-3 py-2 border ${autoFilled ? 'border-green-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900`}
              placeholder="输入电脑端显示的连接ID"
            />
            {autoFilled && (
              <p className="mt-1 text-sm text-green-700">✓ 已自动填充连接ID</p>
            )}
          </div>
          
          <button
            onClick={handleConnect}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={!gyroAvailable}
          >
            连接
          </button>
          
          {!gyroAvailable && (
            <p className="mt-2 text-sm text-red-600">您的设备不支持陀螺仪，无法控制游戏</p>
          )}
          
          <p className="mt-3 text-sm text-center text-gray-700">{connectionStatus}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          <div className="bg-green-100 text-green-800 p-3 rounded-md mb-4 w-full max-w-md">
            <p className="font-semibold text-center">✓ 已连接到电脑</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mb-6">
            <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">控制说明</h2>
            <div className="space-y-3 text-gray-700">
              <p>1. 横握手机，双手握住手机两端</p>
              <p>2. 将手机当作自行车的曲柄</p>
              <p>3. 摇动手机来驱动自行车前进</p>
              <p>4. 摇动越快，自行车速度越快</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">当前速度</h3>
              <button
                onClick={calibrateGyro}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                disabled={isCalibrating}
              >
                {isCalibrating ? '校准中...' : '校准'}
              </button>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">慢</span>
                <span className="text-gray-700">快</span>
              </div>
              <div className="h-6 bg-gray-300 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(Math.max((rotationRate - calibrationOffset) * 10, 0), 100)}%` }}
                ></div>
              </div>
              <p className="text-center mt-2 text-lg font-semibold text-gray-800">
                {((rotationRate - calibrationOffset)).toFixed(1)} km/h
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MobilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900">
      <p className="text-white text-xl">加载中...</p>
    </div>}>
      <MobileGameContent />
    </Suspense>
  );
}