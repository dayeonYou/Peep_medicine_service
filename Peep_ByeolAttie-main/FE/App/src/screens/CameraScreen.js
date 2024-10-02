import {View, Text, Linking, Image} from 'react-native';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {Camera, useCameraDevices} from 'react-native-vision-camera';
import {TouchableOpacity} from 'react-native-gesture-handler';
import { useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import MlkitOcr from 'react-native-mlkit-ocr';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import {useNavigation} from '@react-navigation/native';
import {Shadow} from 'react-native-shadow-2';
import Back from '../../assets/images/Back.svg';

import RNFS from 'react-native-fs';

export default function CameraScreen() {
  const navigation = useNavigation();

  // Camera
  const devices = useCameraDevices();
  const device = devices.back;
  const camera = useRef(null);
  const [imageData, setImageData] = useState('');
  const [takePhotoClicked, setTakePhotoClicked] = useState(true);
  const [recognizedText, setRecognizedText] = useState('');
  const lastProcessedTime = useRef(0);
  const [serverResponse, setServerResponse] = useState(null);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        await requestCameraPermission();
        await initializeOcr();
      } catch (error) {
        console.error('Setup error:', error);
      }
    };

    setupCamera();
  }, []);

  const requestCameraPermission = React.useCallback(async () => {
    const Permission = await Camera.requestCameraPermission();
    console.log(Permission);
    if (Permission === 'denied') {
      await Linking.openSettings();
    }
  }, []);

  const initializeOcr = async () => {
    try {
      await MlkitOcr.init();
      console.log('MlkitOcr initialized');
      const result = await MlkitOcr.downloadModel('ko');
      console.log('Korean model download result:', result);

      const availableModels = await MlkitOcr.getAvailableModels();
      console.log('Available models:', availableModels);
    } catch (error) {
      console.error('Error initializing MlkitOcr:', error);
    }
  };

  // Send image to server
  const sendImageToServer = async (imagePath) => {
    const formData = new FormData();
    formData.append('image', {
      uri: `file://${imagePath}`,
      name: 'image.jpg',
      type: 'image/jpeg',
    });

    try {
      const response = await fetch('http://192.168.45.44:5000/detect', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();
      console.log('Server response:', result.result);
      setServerResponse(result.result);
    } catch (error) {
      console.error('Error sending image to server:', error);
    }
  };

  // Capture and send image every 3 seconds
  const captureAndSendImage = useCallback(async () => {
    if (camera.current) {
      try {
        const photo = await camera.current.takePhoto({
          qualityPrioritization: 'speed',
          flash: 'off',
        });

        console.log('Photo taken:', photo);
        await sendImageToServer(photo.path);
      } catch (error) {
        console.error('Error capturing or sending image:', error);
      }
    }
  }, [camera]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      captureAndSendImage();
    }, 3000); // Capture image every 3 seconds

    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [captureAndSendImage]);

  const takePicture = async () => {
    if (camera != null) {
      const photo = await camera.current.takePhoto();
      const imagePath = photo.path;

      // Save photo logic
      const destinationPath = `${RNFS.DocumentDirectoryPath}/images/1.png`;

      try {
        const dirPath = `${RNFS.DocumentDirectoryPath}/images`;
        if (!(await RNFS.exists(dirPath))) {
          await RNFS.mkdir(dirPath);
        }

        await RNFS.moveFile(imagePath, destinationPath);
        setImageData(destinationPath);
        setTakePhotoClicked(false);

        console.log('Photo saved:', destinationPath);
      } catch (error) {
        console.log('Error saving photo:', error);
      }
    }
  };

  function renderHeader() {
    return (
      <View
        className="flex-row p-4 items-center justify-between z-10"
        style={{
          paddingHorizontal: 10,
        }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Back />
        </TouchableOpacity>
      </View>
    );
  }

  function renderCamera() {
    if (device == null) {
      return <View className="flex-1" />;
    } else {
      return (
        <View className="flex-1">
          {takePhotoClicked ? (
            <View className="flex-1">
              <Camera
                className="flex-1"
                ref={camera}
                device={device}
                isActive={true}
                photo={true}
              />

              {/* Take Photo Button */}
              <View className="absolute items-center bottom-8 left-0 right-0">
                <TouchableOpacity
                  className="rounded-full items-center justify-center bg-white"
                  style={{
                    width: wp(17),
                    height: hp(10),
                  }}
                  onPress={() => {
                    takePicture();
                  }}>
                  <Text style={{fontSize: wp(4.8)}}>O</Text>
                </TouchableOpacity>
              </View>

              {/* Camera State */}
              <View
                className="absolute top-0 left-0 right-0 items-center z-10"
                style={{
                  height: hp(15),
                  paddingVertical: 15,
                }}>
                <Shadow>
                  <View
                    className="flex-1 items-center justify-center rounded-2xl bg-white"
                    style={{width: wp(90)}}>
                    <Text
                      style={{
                        fontSize: wp(4),
                        color: 'black',
                        textAlign: 'center',
                      }}>
                      {typeof recognizedText === 'string'
                        ? recognizedText
                        : 'Scanning...'}
                    </Text>
                  </View>
                </Shadow>
              </View>
            </View>
          ) : (
            <View className="flex-1 justify-center items-center">
              {imageData !== '' && (
                <Image
                  source={{uri: 'file://' + imageData}}
                  style={{width: wp(90), height: hp(70)}}
                />
              )}
              <TouchableOpacity
                className="self-center rounded border-2 justify-center items-center"
                style={{width: wp(90), height: hp(10)}}
                onPress={() => {
                  setTakePhotoClicked(true);
                }}>
                <Text>다시찍기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
  }

  return (
    <View className="flex-1">
      {renderHeader()}
      {renderCamera()}
    </View>
  );
}
