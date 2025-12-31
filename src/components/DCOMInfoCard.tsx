/**
 * @fileoverview DCOM 信息卡片组件
 *
 * 本模块提供显示当前文件 DCOM 认知对象信息的卡片组件。
 * 用于右侧边栏，实时显示当前活动标签页的对象详情。
 *
 * @module components/DCOMInfoCard
 *
 * @features
 * - 显示对象标题和类型
 * - 显示标签和别名
 * - 显示提取的链接
 * - 显示自定义属性
 * - 显示序列化源信息
 *
 * @example
 * ```tsx
 * import { DCOMInfoCard } from './DCOMInfoCard';
 *
 * <DCOMInfoCard filePath="notes/example.md" />
 * ```
 *
 * @exports DCOMInfoCard - DCOM 信息卡片组件
 * @exports DCOMInfo - DCOM 信息接口
 */

import { createSignal, createEffect, Show, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
/* 样式：DCOMInfoCard.css - DCOM 信息卡片样式 */
import './DCOMInfoCard.css';

/* ==========================================================================
   类型定义
   ========================================================================== */

/**
 * DCOM 链接信息接口
 */
interface DCOMLinkInfo {
    /** 链接目标 */
    target: string;
    /** 链接类型 */
    kind: string;
    /** 显示文本 */
    display_text: string | null;
}

/**
 * DCOM 源信息接口
 */
interface DCOMSourceInfo {
    /** 源类型 */
    source_type: string;
    /** 文件路径 */
    path: string | null;
    /** 最后同步时间 */
    last_sync: number | null;
}

/**
 * DCOM 信息接口
 *
 * 从后端返回的认知对象完整信息
 */
export interface DCOMInfo {
    /** 对象唯一标识 */
    id: string;
    /** 标题 */
    title: string;
    /** 对象类型 */
    object_type: string | null;
    /** 标签列表 */
    tags: string[];
    /** 别名列表 */
    aliases: string[];
    /** 链接信息列表 */
    links: DCOMLinkInfo[];
    /** 自定义属性 */
    properties: Record<string, unknown>;
    /** 序列化源信息 */
    sources: DCOMSourceInfo[];
    /** 创建时间戳 */
    created_at: number;
    /** 更新时间戳 */
    updated_at: number;
}

/**
 * DCOMInfoCard 组件属性
 */
interface DCOMInfoCardProps {
    /** 当前文件路径（相对于 vault） */
    filePath: string | null;
}

/* ==========================================================================
   辅助函数
   ========================================================================== */

/**
 * 格式化时间戳为可读字符串
 *
 * @param timestamp - Unix 时间戳（秒或毫秒）
 * @returns 格式化的日期时间字符串
 */
function formatTimestamp(timestamp: number): string {
    // 判断是秒还是毫秒
    const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
    return new Date(ts).toLocaleString();
}

/**
 * 获取链接类型的显示图标
 *
 * @param kind - 链接类型
 * @returns 对应的图标字符
 */
function getLinkIcon(kind: string): string {
    switch (kind) {
        case 'WikiLink':
            return '🔗';
        case 'BlockReference':
            return '📍';
        case 'Embed':
            return '📎';
        case 'External':
            return '🌐';
        default:
            return '→';
    }
}

/* ==========================================================================
   DCOMInfoCard 组件
   ========================================================================== */

/**
 * DCOM 信息卡片组件
 *
 * 显示当前文件的 DCOM 认知对象详细信息。
 * 当 filePath 变化时自动从后端获取新数据。
 *
 * @param props - 组件属性
 * @returns DCOM 信息卡片 JSX
 */
export function DCOMInfoCard(props: DCOMInfoCardProps) {
    /** DCOM 信息状态 */
    const [dcomInfo, setDcomInfo] = createSignal<DCOMInfo | null>(null);
    /** 加载状态 */
    const [loading, setLoading] = createSignal(false);
    /** 错误信息 */
    const [error, setError] = createSignal<string | null>(null);
    /** 展开的部分 */
    const [expandedSections, setExpandedSections] = createSignal<Set<string>>(
        new Set(['basic', 'tags', 'links'])
    );

    /**
     * 切换部分展开状态
     */
    const toggleSection = (section: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    /**
     * 检查部分是否展开
     */
    const isSectionExpanded = (section: string) => expandedSections().has(section);

    // 当 filePath 变化时获取 DCOM 信息
    createEffect(async () => {
        const path = props.filePath;

        if (!path) {
            setDcomInfo(null);
            setError(null);
            return;
        }

        // 只处理 .md 文件
        if (!path.endsWith('.md')) {
            setDcomInfo(null);
            setError('Non-markdown files are not supported yet');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const info = await invoke<DCOMInfo>('get_dcom_info', { path });
            setDcomInfo(info);
        } catch (e) {
            setError(String(e));
            setDcomInfo(null);
        } finally {
            setLoading(false);
        }
    });

    return (
        /* dcom-info-card: 卡片容器 */
        <div class="dcom-info-card">
            {/* 无文件选中状态 */}
            <Show when={!props.filePath}>
                {/* dcom-empty-state: 空状态提示 */}
                <div class="dcom-empty-state">
                    <span class="dcom-empty-icon">📄</span>
                    <p>No file selected</p>
                    <p class="dcom-hint">Open a file to see its DCOM info</p>
                </div>
            </Show>

            {/* 加载状态 */}
            <Show when={loading()}>
                {/* dcom-loading: 加载中状态 */}
                <div class="dcom-loading">
                    <span class="dcom-loading-spinner">⏳</span>
                    <p>Loading...</p>
                </div>
            </Show>

            {/* 错误状态 */}
            <Show when={error() && !loading()}>
                {/* dcom-error: 错误提示 */}
                <div class="dcom-error">
                    <span class="dcom-error-icon">⚠️</span>
                    <p>{error()}</p>
                </div>
            </Show>

            {/* DCOM 信息显示 */}
            <Show when={dcomInfo() && !loading()}>
                {/* 基本信息部分 */}
                {/* dcom-section: 可折叠的信息部分 */}
                <div class="dcom-section">
                    {/* dcom-section-header: 部分标题栏 */}
                    <div
                        class="dcom-section-header"
                        onClick={() => toggleSection('basic')}
                    >
                        {/* dcom-section-toggle: 展开/折叠图标 */}
                        <span class="dcom-section-toggle">
                            {isSectionExpanded('basic') ? '▼' : '▶'}
                        </span>
                        <span>Basic Info</span>
                    </div>
                    <Show when={isSectionExpanded('basic')}>
                        {/* dcom-section-content: 部分内容 */}
                        <div class="dcom-section-content">
                            {/* dcom-field: 单个字段 */}
                            <div class="dcom-field">
                                <span class="dcom-field-label">Title</span>
                                <span class="dcom-field-value">{dcomInfo()!.title}</span>
                            </div>
                            <div class="dcom-field">
                                <span class="dcom-field-label">Type</span>
                                {/* dcom-type-badge: 类型标签 */}
                                <span class="dcom-type-badge">
                                    {dcomInfo()!.object_type || 'untyped'}
                                </span>
                            </div>
                            <div class="dcom-field">
                                <span class="dcom-field-label">ID</span>
                                {/* dcom-id: ID 显示（截断） */}
                                <span class="dcom-id" title={dcomInfo()!.id}>
                                    {dcomInfo()!.id.substring(0, 8)}...
                                </span>
                            </div>
                            <div class="dcom-field">
                                <span class="dcom-field-label">Updated</span>
                                <span class="dcom-field-value">
                                    {formatTimestamp(dcomInfo()!.updated_at)}
                                </span>
                            </div>
                        </div>
                    </Show>
                </div>

                {/* 标签部分 */}
                <Show when={dcomInfo()!.tags.length > 0 || dcomInfo()!.aliases.length > 0}>
                    <div class="dcom-section">
                        <div
                            class="dcom-section-header"
                            onClick={() => toggleSection('tags')}
                        >
                            <span class="dcom-section-toggle">
                                {isSectionExpanded('tags') ? '▼' : '▶'}
                            </span>
                            <span>Tags & Aliases</span>
                            {/* dcom-count-badge: 数量标签 */}
                            <span class="dcom-count-badge">
                                {dcomInfo()!.tags.length + dcomInfo()!.aliases.length}
                            </span>
                        </div>
                        <Show when={isSectionExpanded('tags')}>
                            <div class="dcom-section-content">
                                <Show when={dcomInfo()!.tags.length > 0}>
                                    {/* dcom-tag-list: 标签列表 */}
                                    <div class="dcom-tag-list">
                                        <For each={dcomInfo()!.tags}>
                                            {(tag) => (
                                                /* dcom-tag: 单个标签 */
                                                <span class="dcom-tag">#{tag}</span>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                                <Show when={dcomInfo()!.aliases.length > 0}>
                                    {/* dcom-alias-list: 别名列表 */}
                                    <div class="dcom-alias-list">
                                        <span class="dcom-field-label">Aliases:</span>
                                        <For each={dcomInfo()!.aliases}>
                                            {(alias) => (
                                                /* dcom-alias: 单个别名 */
                                                <span class="dcom-alias">{alias}</span>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        </Show>
                    </div>
                </Show>

                {/* 链接部分 */}
                <Show when={dcomInfo()!.links.length > 0}>
                    <div class="dcom-section">
                        <div
                            class="dcom-section-header"
                            onClick={() => toggleSection('links')}
                        >
                            <span class="dcom-section-toggle">
                                {isSectionExpanded('links') ? '▼' : '▶'}
                            </span>
                            <span>Links</span>
                            <span class="dcom-count-badge">{dcomInfo()!.links.length}</span>
                        </div>
                        <Show when={isSectionExpanded('links')}>
                            <div class="dcom-section-content">
                                {/* dcom-link-list: 链接列表 */}
                                <div class="dcom-link-list">
                                    <For each={dcomInfo()!.links}>
                                        {(link) => (
                                            /* dcom-link-item: 单个链接项 */
                                            <div class="dcom-link-item">
                                                <span class="dcom-link-icon">
                                                    {getLinkIcon(link.kind)}
                                                </span>
                                                <span class="dcom-link-target">
                                                    {link.display_text || link.target}
                                                </span>
                                                <span class="dcom-link-type">{link.kind}</span>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>
                    </div>
                </Show>

                {/* 属性部分 */}
                <Show when={Object.keys(dcomInfo()!.properties).length > 0}>
                    <div class="dcom-section">
                        <div
                            class="dcom-section-header"
                            onClick={() => toggleSection('properties')}
                        >
                            <span class="dcom-section-toggle">
                                {isSectionExpanded('properties') ? '▼' : '▶'}
                            </span>
                            <span>Properties</span>
                            <span class="dcom-count-badge">
                                {Object.keys(dcomInfo()!.properties).length}
                            </span>
                        </div>
                        <Show when={isSectionExpanded('properties')}>
                            <div class="dcom-section-content">
                                {/* dcom-property-list: 属性列表 */}
                                <div class="dcom-property-list">
                                    <For each={Object.entries(dcomInfo()!.properties)}>
                                        {([key, value]) => (
                                            <div class="dcom-field">
                                                <span class="dcom-field-label">{key}</span>
                                                <span class="dcom-field-value">
                                                    {typeof value === 'object'
                                                        ? JSON.stringify(value)
                                                        : String(value)}
                                                </span>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>
                    </div>
                </Show>

                {/* 源信息部分 */}
                <Show when={dcomInfo()!.sources.length > 0}>
                    <div class="dcom-section">
                        <div
                            class="dcom-section-header"
                            onClick={() => toggleSection('sources')}
                        >
                            <span class="dcom-section-toggle">
                                {isSectionExpanded('sources') ? '▼' : '▶'}
                            </span>
                            <span>Sources</span>
                        </div>
                        <Show when={isSectionExpanded('sources')}>
                            <div class="dcom-section-content">
                                <For each={dcomInfo()!.sources}>
                                    {(source) => (
                                        /* dcom-source-item: 单个源项 */
                                        <div class="dcom-source-item">
                                            <span class="dcom-source-type">
                                                {source.source_type}
                                            </span>
                                            <Show when={source.path}>
                                                <span class="dcom-source-path">
                                                    {source.path}
                                                </span>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
