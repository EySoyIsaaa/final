#!/bin/bash

# Script de verificación y compilación para EpicenterDSP Player
# Versión 1.2.0

echo "🔧 EpicenterDSP Player - Build Script v1.2.0"
echo "============================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "android/build.gradle" ]; then
    echo -e "${RED}❌ Error: Este script debe ejecutarse desde la raíz del proyecto${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Paso 1: Verificando configuración...${NC}"

# Verificar Java
echo -n "  Verificando Java... "
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}')
    echo -e "${GREEN}✓ Java $JAVA_VERSION${NC}"
else
    echo -e "${RED}✗ Java no encontrado${NC}"
    echo -e "${YELLOW}  Por favor instala Java 17 o superior${NC}"
    exit 1
fi

# Verificar Node
echo -n "  Verificando Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js no encontrado${NC}"
    exit 1
fi

# Verificar configuración de SDK
echo -n "  Verificando SDK Android... "
if [ -f "android/variables.gradle" ]; then
    COMPILE_SDK=$(grep "compileSdkVersion" android/variables.gradle | awk '{print $3}')
    TARGET_SDK=$(grep "targetSdkVersion" android/variables.gradle | awk '{print $3}')
    if [ "$COMPILE_SDK" == "35" ] && [ "$TARGET_SDK" == "35" ]; then
        echo -e "${GREEN}✓ SDK 35 (Android 15)${NC}"
    else
        echo -e "${YELLOW}⚠ SDK: Compile=$COMPILE_SDK, Target=$TARGET_SDK${NC}"
    fi
else
    echo -e "${RED}✗ variables.gradle no encontrado${NC}"
fi

echo ""
echo -e "${BLUE}🧹 Paso 2: Limpiando proyecto...${NC}"

# Limpiar caché de Gradle
if [ -d "android/.gradle" ]; then
    echo "  Eliminando .gradle..."
    rm -rf android/.gradle
fi

# Limpiar builds anteriores
if [ -d "android/app/build" ]; then
    echo "  Eliminando build anterior..."
    rm -rf android/app/build
fi

if [ -d "android/build" ]; then
    rm -rf android/build
fi

echo -e "${GREEN}  ✓ Proyecto limpio${NC}"

echo ""
echo -e "${BLUE}📦 Paso 3: Compilando proyecto web...${NC}"

# Compilar worklet
echo "  Compilando epicenter-worklet..."
npm run build:worklet > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ Worklet compilado${NC}"
else
    echo -e "${RED}  ✗ Error al compilar worklet${NC}"
    exit 1
fi

# Compilar frontend
echo "  Compilando frontend..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ Frontend compilado${NC}"
else
    echo -e "${RED}  ✗ Error al compilar frontend${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔄 Paso 4: Sincronizando con Android...${NC}"

# Sincronizar con Capacitor (si está disponible)
if command -v npx &> /dev/null; then
    npx cap sync android > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Sincronización completa${NC}"
    else
        echo -e "${YELLOW}  ⚠ Advertencia en sincronización (puede ser normal)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ npx no disponible, omitiendo sync${NC}"
fi

echo ""
echo -e "${BLUE}🏗️  Paso 5: Compilando APK...${NC}"

cd android

# Compilar APK debug
echo "  Ejecutando ./gradlew assembleDebug..."
./gradlew assembleDebug 2>&1 | tee build.log

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ ¡COMPILACIÓN EXITOSA!${NC}"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📱 APK generado:${NC}"
    echo -e "${BLUE}   app/build/outputs/apk/debug/app-debug.apk${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Mostrar información del APK
    if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
        APK_SIZE=$(du -h app/build/outputs/apk/debug/app-debug.apk | awk '{print $1}')
        echo -e "${BLUE}📊 Tamaño: ${NC}$APK_SIZE"
        echo -e "${BLUE}📦 Versión: ${NC}1.2.0 (código 8)"
        echo -e "${BLUE}🎯 SDK Target: ${NC}Android 15 (API 35)"
        echo ""
    fi
    
    echo -e "${YELLOW}💡 Para instalar en tu dispositivo:${NC}"
    echo -e "   ${BLUE}adb install app/build/outputs/apk/debug/app-debug.apk${NC}"
    echo ""
    
else
    echo ""
    echo -e "${RED}❌ Error en la compilación${NC}"
    echo ""
    echo -e "${YELLOW}🔍 Revisa el log para más detalles:${NC}"
    echo -e "   ${BLUE}cat build.log${NC}"
    echo ""
    echo -e "${YELLOW}💡 Soluciones comunes:${NC}"
    echo "   1. Verifica que Android Studio tenga SDK 35 instalado"
    echo "   2. Ejecuta: ./gradlew clean"
    echo "   3. Abre el proyecto en Android Studio y deja que sincronice"
    echo ""
    exit 1
fi

cd ..
