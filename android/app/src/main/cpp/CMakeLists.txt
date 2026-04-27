cmake_minimum_required(VERSION 3.22.1)
project(epicenter_native_dsp)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(epicenter_native SHARED
    epicenter_native_jni.cpp
)

find_library(log-lib log)

# Keep deterministic behavior and speed for real-time processing
target_compile_options(epicenter_native PRIVATE
    -O3
    -ffast-math
    -fno-exceptions
    -fno-rtti
)

target_link_libraries(epicenter_native
    ${log-lib}
)