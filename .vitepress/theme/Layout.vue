<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import MermaidZoom from './MermaidZoom.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-after>
      <MermaidZoom />
    </template>
  </Layout>
</template>
