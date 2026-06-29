<script setup lang="ts">
import { NSpace } from 'naive-ui'
</script>

<template>
  <NSpace vertical align="center" class="home-hero">
    <h1>{{ $t('common.app.title') }}</h1>
    <p>{{ $t('common.app.welcome') }}</p>
  </NSpace>
</template>

<style scoped src="./HomePage.css"></style>
