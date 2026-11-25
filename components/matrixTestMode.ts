/// <reference types="vite/client" />
export const matrixCloudTest = import.meta.env.MODE === 'matrix-test';
export const matrixCloudEnabled = matrixCloudTest || import.meta.env.VITE_ENABLE_LIFE_MATRIX === 'true';
