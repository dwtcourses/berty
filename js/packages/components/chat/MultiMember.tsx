import React, { useState } from 'react'
import {
	TouchableOpacity,
	View,
	KeyboardAvoidingView,
	StatusBar,
	ActivityIndicator,
	SectionListRenderItem,
	SectionListData,
	SectionList,
	ViewToken,
} from 'react-native'
import { Text, Icon } from '@ui-kitten/components'
import { CommonActions } from '@react-navigation/native'
import { groupBy } from 'lodash'
import moment from 'moment'
import { useTranslation } from 'react-i18next'

import { useStyles } from '@berty-tech/styles'
import { Routes, ScreenProps, useNavigation } from '@berty-tech/navigation'
import {
	useConversation,
	useLastConvInteraction,
	useMsgrContext,
	useReadEffect,
	useSortedConvInteractions,
	useNotificationsInhibitor,
} from '@berty-tech/store/hooks'
import beapi from '@berty-tech/api'

import { ChatFooter, ChatDate } from './common'
import { Message } from './message'
import { MessageSystemWrapper } from './message/MessageSystemWrapper'
import BlurView from '../shared-components/BlurView'
import { SwipeNavRecognizer } from '../shared-components/SwipeNavRecognizer'
import { useLayout } from '../hooks'
import { pbDateToNum } from '../helpers'
import { MultiMemberAvatar } from '../avatars'
import { AddFileMenu } from './file-uploads/AddFileMenu'
import { ParsedInteraction } from '@berty-tech/store/types.gen'

//
// MultiMember
//

// Styles

const HeaderMultiMember: React.FC<{
	id: string
	stickyDate?: number
	showStickyDate?: boolean
}> = ({ id, stickyDate, showStickyDate }) => {
	const { navigate, goBack } = useNavigation()
	const [{ row, padding, flex, text, column, margin, color }] = useStyles()
	const conversation = useConversation(id)
	const [layoutHeader, onLayoutHeader] = useLayout() // to position date under blur

	return (
		<View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} onLayout={onLayoutHeader}>
			<BlurView
				blurType='light'
				blurAmount={30}
				style={{ position: 'absolute', bottom: 0, top: 0, left: 0, right: 0 }}
			/>
			<View
				style={[
					flex.align.center,
					flex.direction.row,
					padding.right.medium,
					padding.left.tiny,
					margin.top.scale(50),
					padding.bottom.scale(20),
				]}
			>
				<TouchableOpacity
					style={[flex.tiny, flex.justify.center, flex.align.center]}
					onPress={goBack}
				>
					<Icon name='arrow-back-outline' width={25} height={25} fill={color.black} />
				</TouchableOpacity>
				<View style={[flex.large, column.justify, row.item.justify, margin.top.small]}>
					<View style={[flex.direction.row, flex.justify.center, flex.align.center]}>
						<Text
							numberOfLines={1}
							style={[text.align.center, text.bold.medium, text.size.scale(20)]}
						>
							{conversation?.displayName || ''}
						</Text>
					</View>
				</View>
				<View style={[flex.tiny, row.fill, { alignItems: 'center' }]}>
					<TouchableOpacity
						style={[flex.small, row.right]}
						onPress={() => navigate.chat.groupSettings({ convId: id })}
					>
						<MultiMemberAvatar size={40} />
					</TouchableOpacity>
				</View>
			</View>
			{!!stickyDate && !!showStickyDate && layoutHeader?.height ? (
				<View
					style={{
						position: 'absolute',
						top: layoutHeader.height + 10,
						left: 0,
						right: 0,
					}}
				>
					<ChatDate date={stickyDate} />
				</View>
			) : null}
		</View>
	)
}

const InfosMultiMember: React.FC<beapi.messenger.IConversation> = ({
	createdDate: createdDateStr,
}) => {
	const [{ margin, text, flex }] = useStyles()
	// const members = useConvMembers(publicKey)
	const createdDate = parseInt((createdDateStr as unknown) as string, 10)
	const textColor = '#4E58BF'
	return (
		<View style={[flex.align.center, flex.justify.center]}>
			<ChatDate date={createdDate} />
			<MessageSystemWrapper styleContainer={[margin.top.large, margin.bottom.medium]}>
				<Text style={[text.align.center, { color: textColor }]}>Group joined! 👍</Text>
			</MessageSystemWrapper>
			{/*<MemberList members={Object.keys(members)} />*/}
		</View>
	)
}

const CenteredActivityIndicator: React.FC = (props: ActivityIndicator['props']) => {
	const { ...propsToPass } = props
	return (
		<View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
			<ActivityIndicator {...propsToPass} />
		</View>
	)
}

const _createSections = (items: any[]) => {
	try {
		const grouped = groupBy(items, (m) =>
			moment(pbDateToNum(m?.sentDate || Date.now())).format('DD/MM/YYYY'),
		)
		const mapped = Object.entries(grouped).map(([k, v], i) => ({ title: k, data: v, index: i }))
		return mapped
	} catch (e) {
		console.warn('could not make sections from data:', e)
		return []
	}
}

const MessageList: React.FC<{
	id: string
	scrollToMessage?: string
	setStickyDate: any
	setShowStickyDate: any
}> = ({ id, scrollToMessage, setStickyDate, setShowStickyDate }) => {
	const [{ overflow, margin, row, flex }, { scaleHeight }] = useStyles()
	const conversation = useConversation(id)
	const ctx = useMsgrContext()
	const members = (ctx as any).members[id] || {}
	const interactions = useSortedConvInteractions(id).filter(
		(msg) =>
			msg.type === beapi.messenger.AppMessage.Type.TypeUserMessage ||
			msg.type === beapi.messenger.AppMessage.Type.TypeMonitorMetadata,
	)

	if (conversation?.replyOptions) {
		interactions.push(conversation.replyOptions as ParsedInteraction)
	}
	const initialScrollIndex = React.useMemo(() => {
		if (scrollToMessage) {
			for (let i = 0; i < interactions.length; i++) {
				if (interactions[i] && interactions[i].cid === scrollToMessage) {
					return i
				}
			}
		}
	}, [interactions, scrollToMessage])
	const flatListRef: any = React.useRef(null)

	const onScrollToIndexFailed = () => {
		// Not sure why this happens (something to do with item/screen dimensions I think)
		flatListRef?.current?.scrollToIndex({ index: 0 })
	}

	const items: any = React.useMemo(() => {
		return interactions?.reverse() || []
	}, [interactions])

	const sections = React.useMemo(() => _createSections(items), [items])

	const renderDateFooter: (info: { section: SectionListData<any> }) => React.ReactElement<any> = ({
		section,
	}) => {
		return (
			<View style={[margin.bottom.tiny]}>
				{section?.index > 0 && (
					<ChatDate date={moment(section.title, 'DD/MM/YYYY').unix() * 1000} />
				)}
			</View>
		)
	}
	const renderItem: SectionListRenderItem<any> = ({ item, index }) => {
		return (
			<Message
				id={item?.cid || `${index}`}
				convKind={beapi.messenger.Conversation.Type.MultiMemberType}
				convPK={conversation?.publicKey || ''}
				members={members}
				previousMessageId={index < items.length - 1 ? items[index + 1]?.cid : ''}
				nextMessageId={index > 0 ? items[index - 1]?.cid : ''}
			/>
		)
	}

	const updateStickyDate: (info: { viewableItems: ViewToken[] }) => void = ({ viewableItems }) => {
		if (viewableItems && viewableItems.length) {
			const minDate = viewableItems[viewableItems.length - 1]?.section?.title
			if (minDate) {
				setStickyDate(moment(minDate, 'DD/MM/YYYY').unix() * 1000)
			}
		}
	}

	if (!conversation) {
		return <CenteredActivityIndicator />
	}

	return (
		<SectionList
			initialScrollIndex={initialScrollIndex}
			onScrollToIndexFailed={onScrollToIndexFailed}
			style={[overflow, row.item.fill, flex.tiny, { marginTop: 105 * scaleHeight }]}
			ref={flatListRef}
			keyboardDismissMode='on-drag'
			sections={sections}
			inverted
			keyExtractor={(item: any, index: number) => item?.cid || `${index}`}
			ListFooterComponent={<InfosMultiMember {...conversation} />}
			renderSectionFooter={renderDateFooter}
			renderItem={renderItem}
			onViewableItemsChanged={updateStickyDate}
			initialNumToRender={20}
			onScrollBeginDrag={() => {
				setShowStickyDate(false) // TODO: tmp until hide if start of conversation is visible
			}}
			onScrollEndDrag={() => {
				setTimeout(() => setShowStickyDate(false), 2000)
			}}
		/>
	)
}

const NT = beapi.messenger.StreamEvent.Notified.Type

export const MultiMember: React.FC<ScreenProps.Chat.Group> = ({ route: { params } }) => {
	useNotificationsInhibitor((_ctx, notif) => {
		if (
			notif.type === NT.TypeMessageReceived &&
			(notif.payload as any)?.payload?.interaction?.conversationPublicKey === params?.convId
		) {
			return 'sound-only'
		}
		return false
	})

	const [inputIsFocused, setInputFocus] = useState(false)
	const [{ background, flex }] = useStyles()
	const { dispatch } = useNavigation()
	useReadEffect(params.convId, 1000)
	const conv = useConversation(params?.convId)
	const { t } = useTranslation()

	const lastInte = useLastConvInteraction(params?.convId || '')
	const lastUpdate = conv?.lastUpdate || lastInte?.sentDate || conv?.createdDate || null
	const [stickyDate, setStickyDate] = useState(lastUpdate || null)
	const [showStickyDate, setShowStickyDate] = useState(false)
	const [{ addMedias }, setAddMedias] = useState<{ addMedias: (mediaCids: string[]) => void }>({
		addMedias: () => {},
	})
	const [showAddFileMenu, setShowAddFileMenu] = useState<boolean>(false)

	return (
		<View style={[flex.tiny, background.white]}>
			{showAddFileMenu && (
				<AddFileMenu
					onClose={(newMedias) => {
						addMedias(newMedias)
						setShowAddFileMenu(false)
					}}
				/>
			)}
			<SwipeNavRecognizer
				onSwipeLeft={() =>
					dispatch(
						CommonActions.navigate({
							name: Routes.Chat.MultiMemberSettings,
							params: { convId: params?.convId },
						}),
					)
				}
			>
				<KeyboardAvoidingView style={[flex.tiny]} behavior='padding'>
					<StatusBar backgroundColor='#00BCD4' barStyle='dark-content' />
					<MessageList id={params?.convId} {...{ setStickyDate, setShowStickyDate }} />
					<ChatFooter
						convPk={params?.convId}
						isFocused={inputIsFocused}
						setFocus={setInputFocus}
						placeholder={t('chat.multi-member.input-placeholder')}
						onFileMenuPress={(newAddMedias) => {
							setAddMedias({ addMedias: newAddMedias })
							setShowAddFileMenu(true)
						}}
					/>
					<HeaderMultiMember id={params?.convId} {...({ stickyDate, showStickyDate } as any)} />
				</KeyboardAvoidingView>
			</SwipeNavRecognizer>
		</View>
	)
}
